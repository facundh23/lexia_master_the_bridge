import { OpenAIEmbeddings } from '@langchain/openai';

export function createEmbeddingClient(): OpenAIEmbeddings {
  return new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function embedTexts(client: OpenAIEmbeddings, texts: string[]): Promise<number[][]> {
  return client.embedDocuments(texts);
}

export async function embedQuery(client: OpenAIEmbeddings, text: string): Promise<number[]> {
  return client.embedQuery(text);
}
