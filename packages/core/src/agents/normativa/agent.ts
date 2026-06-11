import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createChromaClient } from '../../storage/chroma.js';
import { createEmbeddingClient } from '../../rag/embed.js';
import { createSearchCorpusTool } from './tools.js';
import { NORMATIVA_SYSTEM_PROMPT } from './prompt.js';
import { sanitizeHistory } from '../../guardrails/input/sanitizeHistory.js';
import { checkForCitations } from '../../guardrails/output/citationEnforcer.js';
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

export interface AgentRunInput {
  content: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: string;
  vertical: string;
  forceRetryWithCitationReminder?: boolean;
}

export interface AgentRunResult {
  response: string;
  citations: string[];
}

export async function runNormativaAgentStream(
  input: AgentRunInput,
  onToken: (token: string) => void,
): Promise<AgentRunResult> {
  const tools: ReturnType<typeof createSearchCorpusTool>[] = [];
  if (process.env.OPENAI_API_KEY) {
    const chroma = createChromaClient();
    const embeddings = createEmbeddingClient();
    tools.push(createSearchCorpusTool(chroma, embeddings, input.userId, input.vertical));
  }

  const hasTools = tools.length > 0;
  // With tools: first LLM call is tool selection (skip), second is the response (emit).
  // Without tools: the single LLM call is the response (emit from start).
  let isStreamingFinalResponse = !hasTools;

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

  const agent = createReactAgent({ llm: model as any, tools });

  const userContent = input.forceRetryWithCitationReminder
    ? `${input.content}\n\n[Por favor, incluye al menos una cita legal específica como "Art. X del Código Civil" o "Art. Y del RD 557/2011" en tu respuesta]`
    : input.content;

  const safeHistory = sanitizeHistory(input.conversationHistory);
  const messages = [
    new SystemMessage({
      content: [{ type: 'text', text: NORMATIVA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } } as any],
    }),
    ...safeHistory.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
    new HumanMessage(userContent),
  ];

  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1];
  const response = extractTextContent(lastMessage?.content);

  const { citations } = checkForCitations(response);

  await logAgentAction({
    agentId: AGENT_IDENTITIES.normativa.id,
    action: 'normativa_response',
    userId: input.userId,
    scopeUsed: 'read:rag_chunks',
    details: { citationsCount: citations.length },
  });

  return { response, citations };
}

export async function runNormativaAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const model = new ChatAnthropic({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
    clientOptions: {
      defaultHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31' },
    },
  });

  const tools = [];
  if (process.env.OPENAI_API_KEY) {
    const chroma = createChromaClient();
    const embeddings = createEmbeddingClient();
    tools.push(createSearchCorpusTool(chroma, embeddings, input.userId, input.vertical));
  }

  const agent = createReactAgent({
    llm: model as any,
    tools,
  });

  const userContent = input.forceRetryWithCitationReminder
    ? `${input.content}\n\n[Por favor, incluye al menos una cita legal específica como "Art. X del Código Civil" o "Art. Y del RD 557/2011" en tu respuesta]`
    : input.content;

  const safeHistory = sanitizeHistory(input.conversationHistory);
  const messages = [
    new SystemMessage({
      content: [{ type: 'text', text: NORMATIVA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } } as any],
    }),
    ...safeHistory.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
    new HumanMessage(userContent),
  ];

  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1];
  const response = extractTextContent(lastMessage?.content);

  const { citations } = checkForCitations(response);

  await logAgentAction({
    agentId: AGENT_IDENTITIES.normativa.id,
    action: 'normativa_response',
    userId: input.userId,
    scopeUsed: 'read:rag_chunks',
    details: { citationsCount: citations.length },
  });

  return { response, citations };
}
