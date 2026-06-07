import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ChromaClient } from 'chromadb';
import type { OpenAIEmbeddings } from '@langchain/openai';
import { retrieveWithACL } from '../../rag/retrieve.js';

export function createSearchCorpusTool(
  chroma: ChromaClient,
  embeddings: OpenAIEmbeddings,
  userId: string,
  vertical: string,
) {
  return tool(
    async ({ query }: { query: string }) => {
      try {
        const results = await retrieveWithACL(chroma, embeddings, query, {
          userId,
          vertical,
          nResults: 5,
        });

        if (results.length === 0) {
          return 'No se encontró información relevante en el corpus para esta consulta. Responde desde tu conocimiento general sobre la normativa española, citando siempre la fuente legal específica (por ejemplo, RD 1004/2015, Art. 22 del Código Civil, Convenio de La Haya, etc.).';
        }

        return results
          .map((r, i) => {
            const source = r.chunk.sourceUrl
              ? `${r.chunk.sourceType} (${r.chunk.sourceUrl})`
              : r.chunk.sourceType;
            return `[Fragmento ${i + 1} — ${source}]\n${r.chunk.text}`;
          })
          .join('\n\n---\n\n');
      } catch (err) {
        console.error('[search_corpus] error al buscar en Chroma:', String(err));
        return 'No se pudo acceder al corpus en este momento. Responde basándote en tu conocimiento general sobre la normativa española de nacionalidad, citando siempre la fuente legal específica (por ejemplo, RD 1004/2015, Art. 22 del Código Civil, Convenio de La Haya, etc.).';
      }
    },
    {
      name: 'search_corpus',
      description:
        'Busca información legal en el corpus de nacionalidad española por residencia. Úsala para responder cualquier pregunta factual sobre requisitos, plazos, documentación o procedimientos.',
      schema: z.object({
        query: z
          .string()
          .describe('La consulta o tema a buscar. Sé específico para obtener mejores resultados.'),
      }),
    },
  );
}
