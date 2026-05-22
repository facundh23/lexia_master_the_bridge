import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { OrchestratorInput } from './state.js';
import { logAgentAction } from '../../nhi/auditLogger.js';
import { AGENT_IDENTITIES } from '../../nhi/agentIdentities.js';

const TriageSchema = z.object({
  route: z
    .enum(['normativa', 'eligibility', 'out_of_scope'])
    .describe(
      'normativa: preguntas sobre leyes, procedimientos, documentación, plazos generales. ' +
        'eligibility: el usuario pregunta si YA cumple los requisitos temporales o cuánto le falta. ' +
        'out_of_scope: preguntas no relacionadas con la nacionalidad española por residencia.',
    ),
  subQuery: z
    .string()
    .describe(
      'La consulta del usuario con su intención preservada, ligeramente reformulada para mayor claridad.',
    ),
});

export type TriageOutput = z.infer<typeof TriageSchema>;

const TRIAGE_SYSTEM_PROMPT = `Eres el enrutador de Lexia. Clasifica la consulta del usuario en una de estas categorías:
- normativa: preguntas sobre requisitos legales, documentación, procedimientos, plazos, leyes (la mayoría de consultas)
- eligibility: el usuario pregunta si ÉL/ELLA ya puede solicitar la nacionalidad o cuánto tiempo le falta específicamente
- out_of_scope: preguntas sin relación con la nacionalidad española por residencia

Devuelve la clasificación y la consulta refinada preservando el idioma del usuario.`;

export async function triageQuery(input: OrchestratorInput): Promise<TriageOutput> {
  const model = new ChatAnthropic({
    model: process.env.TRIAGE_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  }).withStructuredOutput(TriageSchema);

  const recentHistory =
    input.conversationHistory.length > 0
      ? `\nContexto reciente: ${input.conversationHistory
          .slice(-2)
          .map((m) => `${m.role}: ${m.content}`)
          .join(' | ')}`
      : '';

  const triage = await model.invoke([
    new SystemMessage(TRIAGE_SYSTEM_PROMPT),
    new HumanMessage(input.content + recentHistory),
  ]);

  await logAgentAction({
    agentId: AGENT_IDENTITIES.planner.id,
    action: 'triage_query',
    userId: input.userId,
    scopeUsed: 'read:user_context,read:conversation_history',
    details: { route: triage.route },
  });

  return triage;
}
