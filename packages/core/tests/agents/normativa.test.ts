import { describe, it, expect, vi } from 'vitest';

// Mock LangGraph antes del import del módulo bajo test
vi.mock('@langchain/langgraph/prebuilt', () => ({
  createReactAgent: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({
      messages: [
        {
          content:
            'Según el Art. 22 del Código Civil, el plazo es de 10 años de residencia legal en España.',
        },
      ],
    }),
  }),
}));

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('chromadb', () => ({
  ChromaClient: vi.fn().mockImplementation(() => ({
    getOrCreateCollection: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({
        ids: [['c1']],
        documents: [['El Art. 22 CC establece 10 años.']],
        distances: [[0.1]],
        metadatas: [[{ vertical: 'nacionalidad_residencia', visibility: 'public', sourceType: 'codigo_civil', chunkIdx: 0, chunkHash: 'abc' }]],
      }),
    }),
  })),
}));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
  })),
}));

import { runNormativaAgent } from '../../src/agents/normativa/agent.js';

describe('runNormativaAgent', () => {
  it('returns a response string', async () => {
    const result = await runNormativaAgent({
      content: '¿Cuántos años de residencia necesito?',
      conversationHistory: [],
      userId: 'user-1',
      vertical: 'nacionalidad_residencia',
    });

    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  });

  it('extracts citations from response', async () => {
    const result = await runNormativaAgent({
      content: '¿Cuántos años?',
      conversationHistory: [],
      userId: 'u1',
      vertical: 'nacionalidad_residencia',
    });

    expect(Array.isArray(result.citations)).toBe(true);
  });

  it('includes conversation history in messages', async () => {
    const { createReactAgent } = await import('@langchain/langgraph/prebuilt');
    const mockInvoke = vi.fn().mockResolvedValue({ messages: [{ content: 'respuesta' }] });
    vi.mocked(createReactAgent).mockReturnValueOnce({ invoke: mockInvoke } as never);

    await runNormativaAgent({
      content: 'Pregunta nueva',
      conversationHistory: [
        { role: 'user', content: 'Pregunta anterior' },
        { role: 'assistant', content: 'Respuesta anterior' },
      ],
      userId: 'u1',
      vertical: 'nacionalidad_residencia',
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ content: 'Pregunta anterior' }),
          expect.objectContaining({ content: 'Respuesta anterior' }),
          expect.objectContaining({ content: 'Pregunta nueva' }),
        ]),
      }),
    );
  });
});
