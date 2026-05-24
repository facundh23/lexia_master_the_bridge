import { z } from 'zod';
import type { LexiaApiClient } from '../apiClient.js';

export function createGetProcedureRequirementsTool(client: LexiaApiClient) {
  return {
    name: 'get_procedure_requirements' as const,
    description:
      'Devuelve el checklist de requisitos, campos de intake y recordatorios clave para un trámite.',
    inputSchema: {
      vertical: z
        .string()
        .default('nacionalidad_residencia')
        .describe('Vertical: nacionalidad_residencia'),
    },
    async execute(input: { vertical: string }) {
      const result = await client.get<{
        name: string;
        requirements: {
          intakeFields: string[];
          corpusSources: string[];
          reminders: Array<{
            slug: string;
            label: string;
            defaultDaysBeforeDeadline: number;
          }>;
        };
      }>(`/api/mcp/procedure/${encodeURIComponent(input.vertical)}/requirements`);

      const remindersText = result.requirements.reminders
        .map((r) => `• ${r.label} (${r.defaultDaysBeforeDeadline} días antes del plazo)`)
        .join('\n');

      return {
        content: [
          {
            type: 'text' as const,
            text: `## ${result.name}\n\n**Datos necesarios del cliente:**\n${result.requirements.intakeFields.map((f) => `• ${f}`).join('\n')}\n\n**Recordatorios clave:**\n${remindersText}`,
          },
        ],
      };
    },
  };
}
