import { z } from 'zod';
import type { LexiaApiClient } from '../apiClient.js';

export function createComputeEligibilityTool(client: LexiaApiClient) {
  return {
    name: 'compute_eligibility' as const,
    description:
      'Calcula si un cliente cumple el requisito de años de residencia para la nacionalidad española. Resultado determinista basado en Art. 22 CC.',
    inputSchema: {
      countryOrigin: z
        .string()
        .optional()
        .describe('País de origen (e.g. "argentina", "colombia")'),
      arrivalDate: z
        .string()
        .optional()
        .describe('Fecha llegada a España en ISO 8601 (e.g. "2020-03-15")'),
      residenceStatus: z
        .string()
        .optional()
        .describe('Situación: refugee, stateless, u omitir para caso general'),
    },
    async execute(input: {
      countryOrigin?: string;
      arrivalDate?: string;
      residenceStatus?: string;
    }) {
      const result = await client.post<{
        yearsRequired: number;
        yearsElapsed?: number;
        yearsRemaining?: number;
        isEligible?: boolean;
        specialCase: string;
        legalBasis: string;
        notes: string[];
      }>('/api/mcp/eligibility', input);

      const summary = result.isEligible
        ? `ELEGIBLE — ${result.yearsElapsed} años de ${result.yearsRequired} requeridos.`
        : `NO ELEGIBLE — Faltan ${result.yearsRemaining ?? '?'} años. Requisito: ${result.yearsRequired} años.`;

      const notesText =
        result.notes.length > 0
          ? `\n\nNotas:\n${result.notes.map((n) => `• ${n}`).join('\n')}`
          : '';

      return {
        content: [
          {
            type: 'text' as const,
            text: `${summary}\n\nBase legal: ${result.legalBasis}${notesText}`,
          },
        ],
      };
    },
  };
}
