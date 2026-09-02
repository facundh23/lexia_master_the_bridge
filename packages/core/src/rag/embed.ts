import { OpenAIEmbeddings } from '@langchain/openai';
import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

export interface EmbeddingClient {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

const LOCAL_MODEL =
  process.env.EMBEDDING_MODEL ?? 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline('feature-extraction', LOCAL_MODEL);
  return extractorPromise;
}

function createLocalEmbeddingClient(): EmbeddingClient {
  async function embedBatch(texts: string[]): Promise<number[][]> {
    const extractor = await getExtractor();
    const output = await extractor(texts, { pooling: 'mean', normalize: true });
    return output.tolist() as number[][];
  }

  return {
    embedDocuments: (texts) => embedBatch(texts),
     embedQuery: async (text) => {
      const [vector] = await embedBatch([text]);
      if (!vector) throw new Error('Embedding vacío: el modelo no devolvió vector');
      return vector;
    },
  };
}

// --- sin tocar todavía: lo conectamos en el Paso 4 ---
export function createEmbeddingClient(): EmbeddingClient {
  const provider = process.env.EMBEDDING_PROVIDER ?? 'local';

  if (provider === 'openai') {
    return new OpenAIEmbeddings({
      model: process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small',
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  if (provider === 'local') {
    return createLocalEmbeddingClient();
  }

  throw new Error(`EMBEDDING_PROVIDER desconocido: "${provider}" (usá "local" u "openai")`);
}
export async function embedTexts(client: EmbeddingClient, texts: string[]): Promise<number[][]> {
  return client.embedDocuments(texts);
}

export async function embedQuery(client: EmbeddingClient, text: string): Promise<number[]> {
  return client.embedQuery(text);
}
