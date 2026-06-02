import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { computeEligibility } from './tool.js';
import { ELIGIBILITY_SYSTEM_PROMPT } from './prompt.js';
import { sanitizeHistory } from '../../guardrails/input/sanitizeHistory.js';
import { logAgentAction } from '../../nhi/auditLogger.js';
import { AGENT_IDENTITIES } from '../../nhi/agentIdentities.js';

export interface EligibilityAgentInput {
  content: string;
  userId?: string;
  caseData?: {
    countryOrigin?: string;
    arrivalDate?: string;
    residenceStatus?: string;
    hasChildren?: boolean;
  };
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface EligibilityAgentResult {
  response: string;
  citations: string[];
}

const eligibilityTool = tool(
  ({
    countryOrigin,
    arrivalDate,
    residenceStatus,
  }: {
    countryOrigin?: string;
    arrivalDate?: string;
    residenceStatus?: string;
  }) => {
    const result = computeEligibility({ countryOrigin, arrivalDate, residenceStatus });
    return JSON.stringify(result, null, 2);
  },
  {
    name: 'compute_eligibility',
    description:
      'Calcula si el usuario cumple el requisito de tiempo de residencia para la nacionalidad española y cuánto tiempo le falta. Devuelve años requeridos, transcurridos, restantes y base legal.',
    schema: z.object({
      countryOrigin: z.string().optional().describe('País de origen del usuario'),
      arrivalDate: z
        .string()
        .optional()
        .describe('Fecha de llegada a España en formato YYYY-MM-DD'),
      residenceStatus: z
        .string()
        .optional()
        .describe('Estado: legal, irregular, refugiado, apatrida'),
    }),
  },
);

export async function runEligibilityAgent(
  input: EligibilityAgentInput,
): Promise<EligibilityAgentResult> {
  const model = new ChatAnthropic({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const agent = createReactAgent({
    llm: model as any,
    tools: [eligibilityTool],
  });

  const caseContext = input.caseData
    ? `\n\nDatos del expediente del usuario: país de origen: ${input.caseData.countryOrigin ?? 'no especificado'}, fecha de llegada a España: ${input.caseData.arrivalDate ?? 'no especificada'}, estado de residencia: ${input.caseData.residenceStatus ?? 'no especificado'}${input.caseData.hasChildren ? ', tiene hijos menores de edad.' : '.'}`
    : '';

  const safeHistory = sanitizeHistory(input.conversationHistory);
  const messages = [
    new SystemMessage(ELIGIBILITY_SYSTEM_PROMPT + caseContext),
    ...safeHistory.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
    new HumanMessage(input.content),
  ];

  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1];
  const response =
    lastMessage == null
      ? ''
      : typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

  await logAgentAction({
    agentId: AGENT_IDENTITIES.eligibility.id,
    action: 'eligibility_response',
    userId: input.userId ?? 'anonymous',
    scopeUsed: 'read:user_case',
    details: {},
  });

  return {
    response,
    citations: ['Art. 22.1 del Código Civil'],
  };
}
