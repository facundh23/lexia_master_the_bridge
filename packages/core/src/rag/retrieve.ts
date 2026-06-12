import type { ChromaClient } from 'chromadb';
import { getCollection } from '../storage/chroma.js';
import type { OpenAIEmbeddings } from '@langchain/openai';
import { embedQuery } from './embed.js';
import { candidatesCount, rerankChunks } from './rerank.js';
import type { CorpusChunk, RetrieveOptions, RetrievedChunk, SourceType } from './types.js';

export async function retrieveWithACL(
  chroma: ChromaClient,
  embeddings: OpenAIEmbeddings,
  query: string,
  options: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const { userId, vertical, nResults = 6, includePrivate = false } = options;

  // Fetch more candidates than needed so the re-ranker has signal to work with
  const fetchCount = candidatesCount(nResults);

  const queryVector = await embedQuery(embeddings, query);
  const collection = await getCollection(chroma);

  const publicResult = await collection.query({
    queryEmbeddings: [queryVector],
    nResults: fetchCount,
    where: { $and: [{ vertical: { $eq: vertical } }, { visibility: { $eq: 'public' } }] } as any,
    include: ['documents', 'distances', 'metadatas'] as any,
  });

  const candidates: RetrievedChunk[] = buildResults(publicResult as any);

  if (includePrivate) {
    const privateResult = await collection.query({
      queryEmbeddings: [queryVector],
      nResults: fetchCount,
      where: { $and: [{ vertical: { $eq: vertical } }, { visibility: { $eq: 'private' } }, { userId: { $eq: userId } }] } as any,
      include: ['documents', 'distances', 'metadatas'] as any,
    });
    candidates.push(...buildResults(privateResult as any));
  }

  // Sort by distance before passing to re-ranker so the fallback path is consistent
  const sorted = candidates.sort((a, b) => a.distance - b.distance);

  return rerankChunks(query, sorted, nResults);
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
