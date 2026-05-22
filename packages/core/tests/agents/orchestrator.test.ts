import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        route: 'normativa',
        subQuery: '¿Cuántos años necesito para la nacionalidad?',
      }),
    }),
  })),
}));

vi.mock('../../src/agents/orchestrator/triage.js', () => ({
  triageQuery: vi.fn().mockResolvedValue({
    route: 'normativa',
    subQuery: '¿Cuántos años necesito?',
  }),
}));

vi.mock('../../src/agents/normativa/agent.js', () => ({
  runNormativaAgent: vi.fn().mockResolvedValue({
    response: 'Según el Art. 22 CC necesitas 10 años.',
    citations: ['Art. 22 del Código Civil'],
  }),
}));

vi.mock('../../src/agents/eligibility/agent.js', () => ({
  runEligibilityAgent: vi.fn().mockResolvedValue({
    response: 'Llevas 3 años y necesitas 2 (Art. 22.1 CC). Ya eres elegible.',
    citations: ['Art. 22.1 del Código Civil'],
  }),
}));

vi.mock('../../src/agents/validator/index.js', () => ({
  runValidatorAgent: vi.fn().mockResolvedValue({ valid: true, reason: 'mocked' }),
}));

import { triageQuery } from '../../src/agents/orchestrator/triage.js';
import { runNormativaAgent } from '../../src/agents/normativa/agent.js';
import { runEligibilityAgent } from '../../src/agents/eligibility/agent.js';
import { runOrchestrator } from '../../src/agents/orchestrator/graph.js';

describe('triageQuery', () => {
  const baseInput = {
    content: '¿Cuántos años necesito?',
    userId: 'u1',
    vertical: 'nacionalidad_residencia',
    conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
  };

  beforeEach(() => vi.clearAllMocks());

  it('retorna route y subQuery', async () => {
    const result = await triageQuery(baseInput);
    expect(result.route).toMatch(/^(normativa|eligibility|out_of_scope)$/);
    expect(typeof result.subQuery).toBe('string');
  });

  it('retorna normativa para preguntas sobre requisitos', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'normativa',
      subQuery: 'requisitos de residencia',
    });
    const result = await triageQuery({ ...baseInput, content: '¿Qué documentos necesito?' });
    expect(result.route).toBe('normativa');
  });

  it('retorna eligibility para preguntas sobre si ya puede solicitar', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'eligibility',
      subQuery: '¿ya cumple el tiempo?',
    });
    const result = await triageQuery({ ...baseInput, content: '¿Ya puedo solicitarla?' });
    expect(result.route).toBe('eligibility');
  });
});

// --- Tests del orquestador completo ---

const baseOrchestratorInput = {
  content: '¿Cuántos años necesito?',
  userId: 'u1',
  vertical: 'nacionalidad_residencia',
  conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
};

describe('runOrchestrator', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enruta a normativa cuando el triage devuelve normativa', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'normativa',
      subQuery: 'años de residencia requeridos',
    });
    const result = await runOrchestrator(baseOrchestratorInput);
    expect(runNormativaAgent).toHaveBeenCalledOnce();
    expect(result.route).toBe('normativa');
    expect(result.citations).toContain('Art. 22 del Código Civil');
  });

  it('enruta a eligibility cuando el triage devuelve eligibility', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'eligibility',
      subQuery: '¿ya puedo solicitar?',
    });
    const result = await runOrchestrator({
      ...baseOrchestratorInput,
      caseData: { countryOrigin: 'Argentina', arrivalDate: '2022-01-01' },
    });
    expect(runEligibilityAgent).toHaveBeenCalledOnce();
    expect(result.route).toBe('eligibility');
  });

  it('responde out_of_scope sin llamar a ningún agente', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'out_of_scope',
      subQuery: 'receta de paella',
    });
    const result = await runOrchestrator(baseOrchestratorInput);
    expect(runNormativaAgent).not.toHaveBeenCalled();
    expect(runEligibilityAgent).not.toHaveBeenCalled();
    expect(result.route).toBe('out_of_scope');
    expect(result.response).toContain('fuera del ámbito');
  });
});
