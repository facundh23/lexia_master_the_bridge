import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createChromaClient } from '../../storage/chroma.js';
import { createEmbeddingClient } from '../../rag/embed.js';
import { createSearchCorpusTool } from './tools.js';
import { NORMATIVA_SYSTEM_PROMPT } from './prompt.js';
import { checkForCitations } from '../../guardrails/output/citationEnforcer.js';

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

export async function runNormativaAgent(input: AgentRunInput): Promise<AgentRunResult> {
  const chroma = createChromaClient();
  const embeddings = createEmbeddingClient();

  const model = new ChatAnthropic({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const searchTool = createSearchCorpusTool(chroma, embeddings, input.userId, input.vertical);

  const agent = createReactAgent({
    llm: model as any,
    tools: [searchTool],
  });

  const userContent = input.forceRetryWithCitationReminder
    ? `${input.content}\n\n[Por favor, incluye al menos una cita legal específica como "Art. X del Código Civil" o "Art. Y del RD 557/2011" en tu respuesta]`
    : input.content;

  const messages = [
    new SystemMessage(NORMATIVA_SYSTEM_PROMPT),
    ...input.conversationHistory.map((m) =>
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content),
    ),
    new HumanMessage(userContent),
  ];

  const result = await agent.invoke({ messages });

  const lastMessage = result.messages[result.messages.length - 1];
  const response =
    lastMessage == null
      ? ''
      : typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

  const { citations } = checkForCitations(response);

  return { response, citations };
}
