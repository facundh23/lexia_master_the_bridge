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

function extractTextContent(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b?.type === 'text')
      .map((b: any) => b.text ?? '')
      .join('');
  }
  return String(content);
}

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

export async function runEligibilityAgentStream(
  input: EligibilityAgentInput,
  onToken: (token: string) => void,
): Promise<EligibilityAgentResult> {
  // eligibility always has one tool call → stream only after tool returns
  let isStreamingFinalResponse = false;

  const model = new ChatAnthropic({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
    streaming: true,
    clientOptions: {
      defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
    },
    callbacks: [
      {
        handleToolEnd() {
          isStreamingFinalResponse = true;
        },
        handleLLMNewToken(token: string) {
          if (isStreamingFinalResponse) onToken(token);
        },
      },
    ],
  });

  const agent = createReactAgent({ llm: model as any, tools: [eligibilityTool] });

  const caseContext = input.caseData
    ? `\n\nDatos del expediente del usuario: país de origen: ${input.caseData.countryOrigin ?? 'no especificado'}, fecha de llegada a España: ${input.caseData.arrivalDate ?? 'no especificada'}, estado de residencia: ${input.caseData.residenceStatus ?? 'no especificado'}${input.caseData.hasChildren ? ', tiene hijos menores de edad.' : '.'}`
    : '';

  const safeHistory = sanitizeHistory(input.conversationHistory);
  const systemContent: any[] = [
    { type: 'text', text: ELIGIBILITY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (caseContext) systemContent.push({ type: 'text', text: caseContext });

  const messages = [
    new SystemMessage({ content: systemContent }),
    ...safeHistory.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
    new HumanMessage(input.content),
  ];

  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1];
  const response = extractTextContent(lastMessage?.content);

  await logAgentAction({
    agentId: AGENT_IDENTITIES.eligibility.id,
    action: 'eligibility_response',
    userId: input.userId ?? 'anonymous',
    scopeUsed: 'read:user_case',
    details: {},
  });

  return { response, citations: ['Art. 22.1 del Código Civil'] };
}

function getThinkingBudget(caseData?: EligibilityAgentInput['caseData']): number {
  // Complex case (has specific data to reason about) → more tokens
  // General query → lighter budget
  const hasComplexData =
    caseData &&
    (caseData.countryOrigin || caseData.arrivalDate || caseData.residenceStatus);
  return hasComplexData ? 8000 : 3000;
}

export async function runEligibilityAgent(
  input: EligibilityAgentInput,
): Promise<EligibilityAgentResult> {
  const thinkingBudget = getThinkingBudget(input.caseData);
  const model = new ChatAnthropic({
    model: process.env.ANTHROPIC_THINKING_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    // temperature must be 1 when extended thinking is enabled
    temperature: 1,
    maxTokens: thinkingBudget + 4096,
    thinking: { type: 'enabled', budget_tokens: thinkingBudget } as any,
    clientOptions: {
      defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
    },
  });

  const agent = createReactAgent({
    llm: model as any,
    tools: [eligibilityTool],
  });

  const caseContext = input.caseData
    ? `\n\nDatos del expediente del usuario: país de origen: ${input.caseData.countryOrigin ?? 'no especificado'}, fecha de llegada a España: ${input.caseData.arrivalDate ?? 'no especificada'}, estado de residencia: ${input.caseData.residenceStatus ?? 'no especificado'}${input.caseData.hasChildren ? ', tiene hijos menores de edad.' : '.'}`
    : '';

  const safeHistory = sanitizeHistory(input.conversationHistory);
  const systemContent: any[] = [
    { type: 'text', text: ELIGIBILITY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (caseContext) systemContent.push({ type: 'text', text: caseContext });

  const messages = [
    new SystemMessage({ content: systemContent }),
    ...safeHistory.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
    new HumanMessage(input.content),
  ];

  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1];
  const response = extractTextContent(lastMessage?.content);

  await logAgentAction({
    agentId: AGENT_IDENTITIES.eligibility.id,
    action: 'eligibility_response',
    userId: input.userId ?? 'anonymous',
    scopeUsed: 'read:user_case',
    details: { thinkingBudget },
  });

  return {
    response,
    citations: ['Art. 22.1 del Código Civil'],
  };
}
