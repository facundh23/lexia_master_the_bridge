import { ChromaClient } from 'chromadb';

export interface ChromaConfig {
  path?: string;
}

export function createChromaClient(config?: ChromaConfig): ChromaClient {
  return new ChromaClient({ path: config?.path ?? process.env.CHROMA_URL ?? 'http://localhost:8000' });
}

export async function ensureCollection(client: ChromaClient, collectionName = 'lexia_corpus'): Promise<void> {
  await client.getOrCreateCollection({
    name: collectionName,
    metadata: { 'hnsw:space': 'cosine' },
  });
}
