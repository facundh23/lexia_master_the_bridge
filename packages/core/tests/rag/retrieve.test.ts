import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChromaClient } from 'chromadb';
import type { OpenAIEmbeddings } from '@langchain/openai';
import { retrieveWithACL } from '../../src/rag/retrieve.js';

// Mock global fetch used by ensureCollection (raw HTTP call to Chroma)
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

const mockQueryResult = {
  ids: [['chunk-1', 'chunk-2']],
  documents: [['Texto del chunk 1', 'Texto del chunk 2']],
  distances: [[0.12, 0.34]],
  metadatas: [
    [
      {
        vertical: 'nacionalidad_residencia',
        visibility: 'public',
        sourceType: 'codigo_civil',
        chunkIdx: 0,
        chunkHash: 'abc123',
      },
      {
        vertical: 'nacionalidad_residencia',
        visibility: 'public',
        sourceType: 'BOE',
        chunkIdx: 1,
        chunkHash: 'def456',
      },
    ],
  ],
};

const mockCollection = {
  query: vi.fn().mockResolvedValue(mockQueryResult),
};

const mockChroma = {
  getCollection: vi.fn().mockResolvedValue(mockCollection),
} as unknown as ChromaClient;

const mockEmbedding = {
  embedQuery: vi.fn().mockResolvedValue(Array(1536).fill(0.1)),
} as unknown as OpenAIEmbeddings;

describe('retrieveWithACL', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queries Chroma with $and filter for vertical + visibility', async () => {
    await retrieveWithACL(mockChroma, mockEmbedding, 'cuántos años de residencia', {
      userId: 'user-1',
      vertical: 'nacionalidad_residencia',
    });

    expect(mockCollection.query).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          $and: [
            { vertical: { $eq: 'nacionalidad_residencia' } },
            { visibility: { $eq: 'public' } },
          ],
        },
      }),
    );
  });

  it('returns RetrievedChunk array sorted by distance', async () => {
    const results = await retrieveWithACL(mockChroma, mockEmbedding, 'cuántos años', {
      userId: 'user-1',
      vertical: 'nacionalidad_residencia',
    });

    expect(results).toHaveLength(2);
    expect(results[0].distance).toBeLessThanOrEqual(results[1].distance);
    expect(results[0].chunk.text).toBe('Texto del chunk 1');
    expect(results[0].chunk.vertical).toBe('nacionalidad_residencia');
  });

  it('filters out null documents', async () => {
    mockCollection.query.mockResolvedValueOnce({
      ids: [['c1', 'c2']],
      documents: [[null, 'Texto válido']],
      distances: [[0.1, 0.2]],
      metadatas: [
        [
          { vertical: 'n', visibility: 'public', sourceType: 'BOE', chunkIdx: 0, chunkHash: 'x' },
          { vertical: 'n', visibility: 'public', sourceType: 'BOE', chunkIdx: 1, chunkHash: 'y' },
        ],
      ],
    });

    const results = await retrieveWithACL(mockChroma, mockEmbedding, 'query', {
      userId: 'u1',
      vertical: 'n',
    });

    expect(results).toHaveLength(1);
    expect(results[0].chunk.text).toBe('Texto válido');
  });
});
