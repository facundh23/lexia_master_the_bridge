import type { ChromaClient } from 'chromadb';
import { getCollection } from '../storage/chroma.js';
import type { EmbeddingClient } from './embed.js';
import { embedTexts } from './embed.js';
import type { CorpusChunk } from './types.js';

export async function ingestChunks(
  chroma: ChromaClient,
   embeddings: EmbeddingClient,
  chunks: CorpusChunk[],
  collectionName = 'lexia_corpus',
): Promise<void> {
  if (chunks.length === 0) return;

  const collection = await getCollection(chroma, collectionName);
  const texts = chunks.map((c) => c.text);
  const vectors = await embedTexts(embeddings, texts);

  await collection.upsert({
    ids: chunks.map((c) => c.id),
    documents: texts,
    embeddings: vectors,
    metadatas: chunks.map((c) => ({
      vertical: c.vertical,
      visibility: c.visibility,
      ...(c.userId ? { userId: c.userId } : {}),
      ...(c.caseId ? { caseId: c.caseId } : {}),
      sourceType: c.sourceType,
      ...(c.sourceUrl ? { sourceUrl: c.sourceUrl } : {}),
      ...(c.documentId ? { documentId: c.documentId } : {}),
      chunkIdx: c.chunkIdx,
      chunkHash: c.chunkHash,
      ...(c.publishedDate ? { publishedDate: c.publishedDate } : {}),
    })),
  });
}
