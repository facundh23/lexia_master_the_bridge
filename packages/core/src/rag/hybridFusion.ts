import type { RetrievedChunk } from './types.js';

const RRF_K = 60;

export function reciprocalRankFusion(
  denseRanking: RetrievedChunk[],
  sparseRanking: RetrievedChunk[],
): RetrievedChunk[] {
  const rrfScores = new Map<string, number>();
  const byId = new Map<string, RetrievedChunk>();

  const addRanking = (ranked: RetrievedChunk[]) => {
    ranked.forEach((chunk, rank) => {
      const id = chunk.chunk.id;
      rrfScores.set(id, (rrfScores.get(id) ?? 0) + 1 / (RRF_K + rank + 1));
      byId.set(id, chunk);
    });
  };

  addRanking(denseRanking);
  addRanking(sparseRanking);

  return [...byId.values()].sort(
    (a, b) => (rrfScores.get(b.chunk.id) ?? 0) - (rrfScores.get(a.chunk.id) ?? 0),
  );
}
