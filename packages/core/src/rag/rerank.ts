import type { RetrievedChunk } from './types.js';

const RERANK_MODEL = 'rerank-v3.5';
const RERANK_CANDIDATES_MULTIPLIER = 3;

/**
 * How many candidates to fetch from the vector store before re-ranking.
 * Fetching 3× the desired topK gives the re-ranker enough signal to work with.
 */
export function candidatesCount(topK: number): number {
  return topK * RERANK_CANDIDATES_MULTIPLIER;
}

/**
 * Re-ranks `candidates` against `query` using Cohere Rerank v3.5.
 * Falls back to the original distance ordering if COHERE_API_KEY is absent.
 */
export async function rerankChunks(
  query: string,
  candidates: RetrievedChunk[],
  topK: number,
): Promise<RetrievedChunk[]> {
  if (candidates.length <= topK) return candidates;

  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    // No API key — return original distance-sorted top-K (graceful fallback)
    return candidates.slice(0, topK);
  }

  try {
    const { CohereClient } = await import('cohere-ai');
    const cohere = new CohereClient({ token: apiKey });

    const response = await cohere.rerank({
      model: RERANK_MODEL,
      query,
      documents: candidates.map((c) => c.chunk.text),
      topN: topK,
      returnDocuments: false,
    });

    return response.results.map((r) => {
      const candidate = candidates[r.index]!;
      return { ...candidate, rerankScore: r.relevanceScore };
    });
  } catch (err) {
    console.error('[rerank] Cohere rerank failed, falling back to distance order:', String(err));
    return candidates.slice(0, topK);
  }
}
