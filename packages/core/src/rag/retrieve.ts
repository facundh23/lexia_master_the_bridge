import type { ChromaClient } from 'chromadb';
import { getCollection } from '../storage/chroma.js';
import type { EmbeddingClient } from './embed.js';
import { embedQuery } from './embed.js';
import { candidatesCount, rerankChunks } from './rerank.js';
import { extractKeyTerms, bm25Score } from './bm25.js';
import { reciprocalRankFusion } from './hybridFusion.js';
import type { CorpusChunk, RetrieveOptions, RetrievedChunk, SourceType } from './types.js';

export async function retrieveWithACL(
  chroma: ChromaClient,
  embeddings: EmbeddingClient,
  query: string,
  options: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const { userId, vertical, nResults = 6, includePrivate = false } = options;

  const fetchCount = candidatesCount(nResults);
  const queryVector = await embedQuery(embeddings, query);
  const collection = await getCollection(chroma);

  // --- Dense retrieval (semantic similarity via embeddings) ---
  const publicDenseResult = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: fetchCount,
    where: { $and: [{ vertical: { $eq: vertical } }, { visibility: { $eq: 'public' } }] } as any,
    include: ['documents', 'distances', 'metadatas'] as any,
  });
  const denseCandidates: RetrievedChunk[] = buildResults(publicDenseResult as any);

  if (includePrivate) {
    const privateDenseResult = await collection.query({
      queryEmbeddings: [queryVector],
      nResults: fetchCount,
      where: {
        $and: [
          { vertical: { $eq: vertical } },
          { visibility: { $eq: 'private' } },
          { userId: { $eq: userId } },
        ],
      } as any,
      include: ['documents', 'distances', 'metadatas'] as any,
    });
    denseCandidates.push(...buildResults(privateDenseResult as any));
  }

  // --- Sparse retrieval (keyword-filtered lexical candidates) ---
  const sparseCandidates: RetrievedChunk[] = [];
  const keyTerms = extractKeyTerms(query, 3);

  if (keyTerms.length > 0) {
    const keywordFilter =
      keyTerms.length === 1
        ? { $contains: keyTerms[0] }
        : { $or: keyTerms.map((t) => ({ $contains: t })) };

    try {
      const publicSparseResult = await collection.query({
        queryEmbeddings: [queryVector],
        nResults: nResults,
        where: {
          $and: [{ vertical: { $eq: vertical } }, { visibility: { $eq: 'public' } }],
        } as any,
        whereDocument: keywordFilter as any,
        include: ['documents', 'distances', 'metadatas'] as any,
      });
      sparseCandidates.push(...buildResults(publicSparseResult as any));

      if (includePrivate) {
        const privateSparseResult = await collection.query({
          queryEmbeddings: [queryVector],
          nResults: nResults,
          where: {
            $and: [
              { vertical: { $eq: vertical } },
              { visibility: { $eq: 'private' } },
              { userId: { $eq: userId } },
            ],
          } as any,
          whereDocument: keywordFilter as any,
          include: ['documents', 'distances', 'metadatas'] as any,
        });
        sparseCandidates.push(...buildResults(privateSparseResult as any));
      }
    } catch {
      // where_document unsupported in this Chroma version — skip sparse path
    }
  }

  // --- BM25 scoring to rank sparse candidates by term relevance ---
  const sparseTexts = sparseCandidates.map((c) => c.chunk.text);
  const sparseScores = bm25Score(query, sparseTexts);
  const sparseSorted = sparseCandidates
    .map((c, i) => ({ c, score: sparseScores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .map(({ c }) => c);

  // --- Reciprocal Rank Fusion: combines dense rank + BM25 rank ---
  const denseSorted = denseCandidates.sort((a, b) => a.distance - b.distance);
  const fused = reciprocalRankFusion(denseSorted, sparseSorted);

  // --- Cohere rerank as final pass over the fused candidates ---
  return rerankChunks(query, fused.slice(0, fetchCount), nResults);
}

function buildResults(queryResult: {
  ids: string[][];
  documents: (string | null)[][];
  distances: (number | null)[][];
  metadatas: Record<string, unknown>[][];
}): RetrievedChunk[] {
  const ids = queryResult.ids[0] ?? [];
  const docs = queryResult.documents[0] ?? [];
  const distances = queryResult.distances[0] ?? [];
  const metas = queryResult.metadatas[0] ?? [];

  const results: RetrievedChunk[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const text = docs[i];
    if (!text || !id) continue;

    const meta = metas[i] ?? {};

    results.push({
      chunk: {
        id,
        text,
        vertical: String(meta.vertical ?? ''),
        visibility: (meta.visibility as 'public' | 'private') ?? 'public',
        userId: meta.userId ? String(meta.userId) : undefined,
        caseId: meta.caseId ? String(meta.caseId) : undefined,
        sourceType: (meta.sourceType as SourceType) ?? 'BOE',
        sourceUrl: meta.sourceUrl ? String(meta.sourceUrl) : undefined,
        documentId: meta.documentId ? String(meta.documentId) : undefined,
        chunkIdx: Number(meta.chunkIdx ?? 0),
        chunkHash: String(meta.chunkHash ?? ''),
        publishedDate: meta.publishedDate ? String(meta.publishedDate) : undefined,
      },
      distance: distances[i] ?? 1,
    });
  }

  return results;
}
