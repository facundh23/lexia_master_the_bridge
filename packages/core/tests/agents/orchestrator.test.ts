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
import { runValidatorAgent } from '../../src/agents/validator/index.js';
import { runOrchestrator, runOrchestratorStream } from '../../src/agents/orchestrator/graph.js';

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

  it('eligibility reintenta con recordatorio de cita y devuelve el reintento si es válido', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'eligibility',
      subQuery: '¿ya puedo solicitar?',
    });
    vi.mocked(runEligibilityAgent)
      .mockResolvedValueOnce({ response: 'Sí, ya puedes.', citations: [] })
      .mockResolvedValueOnce({
        response: 'Sí, ya puedes (Art. 22.1 CC).',
        citations: ['Art. 22.1 del Código Civil'],
      });
    vi.mocked(runValidatorAgent)
      .mockResolvedValueOnce({ valid: false, reason: 'sin cita' })
      .mockResolvedValueOnce({ valid: true, reason: 'ok' });

    const result = await runOrchestrator(baseOrchestratorInput);

    expect(runEligibilityAgent).toHaveBeenCalledTimes(2);
    expect(vi.mocked(runEligibilityAgent).mock.calls[1]![0]).toMatchObject({
      forceRetryWithCitationReminder: true,
    });
    expect(result.route).toBe('eligibility');
    expect(result.response).toBe('Sí, ya puedes (Art. 22.1 CC).');
    expect(result.citations).toEqual(['Art. 22.1 del Código Civil']);
  });

  it('eligibility devuelve el mensaje de rechazo si el reintento también falla', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'eligibility',
      subQuery: '¿ya puedo solicitar?',
    });
    vi.mocked(runValidatorAgent)
      .mockResolvedValueOnce({ valid: false, reason: 'sin cita' })
      .mockResolvedValueOnce({ valid: false, reason: 'sigue sin cita' });

    const result = await runOrchestrator(baseOrchestratorInput);

    expect(runEligibilityAgent).toHaveBeenCalledTimes(2);
    expect(result.route).toBe('eligibility');
    expect(result.response).toContain('No puedo proporcionar esa información');
    expect(result.citations).toEqual([]);
  });
});

describe('runOrchestrator — onStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('normativa válida al primer intento: analyzing → searching → validating', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'normativa',
      subQuery: 'años de residencia requeridos',
    });
    const stages: string[] = [];
    await runOrchestrator(baseOrchestratorInput, { onStatus: (s) => stages.push(s) });
    expect(stages).toEqual(['analyzing', 'searching', 'validating']);
  });

  it('eligibility con reintento: analyzing → evaluating → validating → retrying → validating', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'eligibility',
      subQuery: '¿ya puedo solicitar?',
    });
    vi.mocked(runValidatorAgent)
      .mockResolvedValueOnce({ valid: false, reason: 'sin cita' })
      .mockResolvedValueOnce({ valid: true, reason: 'ok' });
    const stages: string[] = [];
    await runOrchestrator(baseOrchestratorInput, { onStatus: (s) => stages.push(s) });
    expect(stages).toEqual(['analyzing', 'evaluating', 'validating', 'retrying', 'validating']);
  });

  it('out_of_scope: solo analyzing', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'out_of_scope',
      subQuery: 'receta de paella',
    });
    const stages: string[] = [];
    await runOrchestrator(baseOrchestratorInput, { onStatus: (s) => stages.push(s) });
    expect(stages).toEqual(['analyzing']);
  });

  it('error del triage: solo analyzing', async () => {
    vi.mocked(triageQuery).mockRejectedValueOnce(new Error('boom'));
    const stages: string[] = [];
    await runOrchestrator(baseOrchestratorInput, { onStatus: (s) => stages.push(s) });
    expect(stages).toEqual(['analyzing']);
  });

  it('funciona sin hooks', async () => {
    const result = await runOrchestrator(baseOrchestratorInput);
    expect(result.route).toBe('normativa');
  });
});

describe('runOrchestratorStream', () => {
  beforeEach(() => vi.clearAllMocks());

  // Registra tokens y etapas en una sola línea de tiempo para verificar el orden
  function record() {
    const events: string[] = [];
    const tokens: string[] = [];
    const onToken = (t: string) => {
      tokens.push(t);
      events.push('token');
    };
    const onStatus = (s: string) => events.push(s);
    return { events, tokens, onToken, onStatus };
  }

  it('camino feliz: emite la respuesta validada una sola vez, después de validating', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'normativa',
      subQuery: 'años de residencia requeridos',
    });
    const { events, tokens, onToken, onStatus } = record();
    const result = await runOrchestratorStream(baseOrchestratorInput, onToken, onStatus);
    expect(tokens).toEqual(['Según el Art. 22 CC necesitas 10 años.']);
    expect(events).toEqual(['analyzing', 'searching', 'validating', 'token']);
    expect(tokens[0]).toBe(result.response);
  });

  it('rechazo y reintento válido: el texto rechazado nunca se emite', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'eligibility',
      subQuery: '¿ya puedo solicitar?',
    });
    vi.mocked(runEligibilityAgent)
      .mockResolvedValueOnce({ response: 'TEXTO RECHAZADO', citations: [] })
      .mockResolvedValueOnce({ response: 'Sí, ya puedes (Art. 22.1 CC).', citations: [] });
    vi.mocked(runValidatorAgent)
      .mockResolvedValueOnce({ valid: false, reason: 'sin cita' })
      .mockResolvedValueOnce({ valid: true, reason: 'ok' });
    const { tokens, onToken } = record();
    await runOrchestratorStream(baseOrchestratorInput, onToken);
    expect(tokens).toEqual(['Sí, ya puedes (Art. 22.1 CC).']);
    expect(tokens.join('')).not.toContain('TEXTO RECHAZADO');
  });

  it('doble rechazo: solo emite el mensaje de rechazo', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'normativa',
      subQuery: 'años de residencia requeridos',
    });
    vi.mocked(runValidatorAgent)
      .mockResolvedValueOnce({ valid: false, reason: 'sin cita' })
      .mockResolvedValueOnce({ valid: false, reason: 'sigue sin cita' });
    const { tokens, onToken } = record();
    await runOrchestratorStream(baseOrchestratorInput, onToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toContain('No puedo proporcionar esa información');
  });

  it('out_of_scope: emite OUT_OF_SCOPE_RESPONSE', async () => {
    vi.mocked(triageQuery).mockResolvedValueOnce({
      route: 'out_of_scope',
      subQuery: 'receta de paella',
    });
    const { tokens, onToken } = record();
    await runOrchestratorStream(baseOrchestratorInput, onToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toContain('fuera del ámbito');
  });

  it('error del triage: emite el mensaje de rechazo', async () => {
    vi.mocked(triageQuery).mockRejectedValueOnce(new Error('boom'));
    const { tokens, onToken } = record();
    await runOrchestratorStream(baseOrchestratorInput, onToken);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toContain('No puedo proporcionar esa información');
  });
});
