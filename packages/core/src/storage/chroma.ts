import { ChromaClient } from 'chromadb';

export interface ChromaConfig {
  path?: string;
}

// Stub used to bypass chromadb v3's DefaultEmbeddingFunction (requires @chroma-core/default-embed).
// Never actually invoked — we always provide pre-computed OpenAI vectors.
const STUB_EF = {
  generate: async (texts: string[]): Promise<number[][]> => texts.map(() => []),
};

export function createChromaClient(_config?: ChromaConfig): ChromaClient {
  const url = new URL(process.env.CHROMA_URL ?? 'http://localhost:8000');
  return new ChromaClient({
    host: url.hostname,
    port: Number(url.port) || 8000,
    ssl: url.protocol === 'https:',
  });
}

export async function ensureCollection(
  _client: ChromaClient,
  collectionName = 'lexia_corpus',
): Promise<void> {
  // Use raw HTTP to create the collection without sending embedding function metadata,
  // which chromadb v3 JS client sends incorrectly causing KeyError('_type') on the server.
  const baseUrl = process.env.CHROMA_URL ?? 'http://localhost:8000';
  const res = await fetch(
    `${baseUrl}/api/v2/tenants/default_tenant/databases/default_database/collections`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: collectionName,
        metadata: { 'hnsw:space': 'cosine' },
        get_or_create: true,
      }),
    },
  );
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Chroma collection creation failed: ${res.status} ${text}`);
  }
}

export async function getCollection(client: ChromaClient, collectionName = 'lexia_corpus') {
  // Ensure collection exists first (idempotent), then get it
  await ensureCollection(client, collectionName);
  return client.getCollection({ name: collectionName, embeddingFunction: STUB_EF as any });
}
