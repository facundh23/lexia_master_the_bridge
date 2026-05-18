import { describe, it, expect, vi } from 'vitest';

vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({
      messages: [
        {
          content:
            'Según el Art. 22.1 del Código Civil, como ciudadano de Argentina necesitas 2 años de residencia legal. Llevas 3 años en España, por lo que ya puedes solicitar la nacionalidad.',
        },
      ],
    }),
  }),
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({})),
}));

import { computeEligibility } from '../../src/agents/eligibility/tool.js';
import { runEligibilityAgent } from '../../src/agents/eligibility/agent.js';

describe('computeEligibility', () => {
  it('aplica regla general: 10 años para países no iberoamericanos', () => {
    const r = computeEligibility({ countryOrigin: 'Marruecos', residenceStatus: 'legal' });
    expect(r.yearsRequired).toBe(10);
    expect(r.specialCase).toBe('general');
    expect(r.legalBasis).toContain('Art. 22');
  });

  it('aplica 2 años para países iberoamericanos (Argentina)', () => {
    const r = computeEligibility({ countryOrigin: 'Argentina' });
    expect(r.yearsRequired).toBe(2);
    expect(r.specialCase).toBe('iberoamerican');
  });

  it('aplica 2 años para Portugal (case-insensitive)', () => {
    const r = computeEligibility({ countryOrigin: 'PORTUGAL' });
    expect(r.yearsRequired).toBe(2);
  });

  it('aplica 5 años para refugiados', () => {
    const r = computeEligibility({ residenceStatus: 'refugiado' });
    expect(r.yearsRequired).toBe(5);
    expect(r.specialCase).toBe('refugee');
  });

  it('calcula años transcurridos y si ya es elegible', () => {
    const arrival = new Date();
    arrival.setFullYear(arrival.getFullYear() - 11);
    const r = computeEligibility({
      countryOrigin: 'Marruecos',
      arrivalDate: arrival.toISOString().split('T')[0],
    });
    expect(r.yearsElapsed).toBeGreaterThanOrEqual(11);
    expect(r.isEligible).toBe(true);
    expect(r.yearsRemaining).toBe(0);
  });

  it('calcula años restantes cuando no es elegible aún', () => {
    const arrival = new Date();
    arrival.setFullYear(arrival.getFullYear() - 3);
    const r = computeEligibility({
      countryOrigin: 'Marruecos',
      arrivalDate: arrival.toISOString().split('T')[0],
    });
    expect(r.isEligible).toBe(false);
    expect(r.yearsRemaining).toBeGreaterThan(0);
  });

  it('maneja entrada vacía sin lanzar error', () => {
    const r = computeEligibility({});
    expect(r.yearsRequired).toBe(10);
    expect(r.yearsElapsed).toBeUndefined();
    expect(r.isEligible).toBeUndefined();
  });
});

describe('runEligibilityAgent', () => {
  it('retorna respuesta string con citaciones legales', async () => {
    const result = await runEligibilityAgent({
      content: '¿Ya puedo pedir la nacionalidad?',
      caseData: { countryOrigin: 'Argentina', arrivalDate: '2021-01-01', residenceStatus: 'legal' },
      conversationHistory: [],
    });
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
    expect(result.citations).toContain('Art. 22.1 del Código Civil');
  });

  it('funciona sin caseData (caso sin perfil de usuario)', async () => {
    const result = await runEligibilityAgent({
      content: '¿Cuántos años necesito si soy de México?',
      conversationHistory: [],
    });
    expect(typeof result.response).toBe('string');
  });
});
