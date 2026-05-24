import { z } from 'zod';
import type { LexiaApiClient } from '../apiClient.js';

export function createSearchCorpusTool(client: LexiaApiClient) {
  return {
    name: 'search_corpus_with_citations' as const,
    description:
      'Busca en el corpus legal de Lexia (BOE, Código Civil, instrucciones DGRN) y devuelve respuesta con citas legales. Usar para responder consultas normativas de clientes.',
    inputSchema: {
      query: z.string().describe('Consulta en lenguaje natural sobre normativa de extranjería'),
      vertical: z
        .string()
        .default('nacionalidad_residencia')
        .describe('Vertical: nacionalidad_residencia'),
    },
    async execute(input: { query: string; vertical?: string }) {
      const result = await client.post<{ response: string; citations: string[] }>(
        '/api/mcp/search',
        input,
      );
      const citationsText =
        result.citations.length > 0 ? `\n\nCitas: ${result.citations.join(', ')}` : '';
      return {
        content: [{ type: 'text' as const, text: `${result.response}${citationsText}` }],
      };
    },
  };
}
