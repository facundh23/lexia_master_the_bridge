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

import { triageQuery } from '../../src/agents/orchestrator/triage.js';

describe('triageQuery', () => {
  const baseInput = {
    content: '¿Cuántos años necesito?',
    userId: 'u1',
    vertical: 'nacionalidad_residencia',
    conversationHistory: [] as Array<{ role: 'user' | 'assistant'; content: string }>,
  };

  it('retorna route y subQuery', async () => {
    const result = await triageQuery(baseInput);
    expect(result.route).toMatch(/^(normativa|eligibility|out_of_scope)$/);
    expect(typeof result.subQuery).toBe('string');
  });

  it('retorna normativa para preguntas sobre requisitos', async () => {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    vi.mocked(ChatAnthropic).mockImplementationOnce(
      () =>
        ({
          withStructuredOutput: vi.fn().mockReturnValue({
            invoke: vi.fn().mockResolvedValue({
              route: 'normativa',
              subQuery: 'requisitos de residencia',
            }),
          }),
        }) as any,
    );
    const result = await triageQuery({ ...baseInput, content: '¿Qué documentos necesito?' });
    expect(result.route).toBe('normativa');
  });

  it('retorna eligibility para preguntas sobre si ya puede solicitar', async () => {
    const { ChatAnthropic } = await import('@langchain/anthropic');
    vi.mocked(ChatAnthropic).mockImplementationOnce(
      () =>
        ({
          withStructuredOutput: vi.fn().mockReturnValue({
            invoke: vi.fn().mockResolvedValue({
              route: 'eligibility',
              subQuery: '¿ya cumple el tiempo?',
            }),
          }),
        }) as any,
    );
    const result = await triageQuery({ ...baseInput, content: '¿Ya puedo solicitarla?' });
    expect(result.route).toBe('eligibility');
  });
});
