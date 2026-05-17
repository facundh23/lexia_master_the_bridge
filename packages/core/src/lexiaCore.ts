import { runInputPipeline } from './guardrails/input/index.js';
import { runOutputPipeline } from './guardrails/output/index.js';
import { runNormativaAgent } from './agents/normativa/agent.js';
import type { BlockReason } from './guardrails/input/index.js';

const CANNED_RESPONSES: Record<BlockReason, string> = {
  jailbreak_attempt:
    'Lo siento, no puedo procesar esa solicitud. Estoy diseñado para ayudarte con información sobre la nacionalidad española por residencia. ¿Tienes alguna pregunta sobre ese tema?\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*',
  pii_detected:
    'He detectado información personal sensible en tu mensaje. He eliminado esos datos antes de procesarlo. Por favor, evita incluir documentos de identidad, números de cuenta u otra información personal en tus consultas.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*',
};

export interface LexiaCoreInput {
  content: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  userId: string;
  vertical: string;
}

export interface LexiaCoreResult {
  response: string;
  blocked: boolean;
  blockReason?: BlockReason;
  citations: string[];
}

export async function runLexiaCore(input: LexiaCoreInput): Promise<LexiaCoreResult> {
  // 1. Input guardrails
  const inputResult = runInputPipeline(input.content);

  if (inputResult.blocked) {
    return {
      response: CANNED_RESPONSES[inputResult.reason!],
      blocked: true,
      blockReason: inputResult.reason,
      citations: [],
    };
  }

  const agentInput = {
    content: inputResult.sanitized,
    conversationHistory: input.conversationHistory,
    userId: input.userId,
    vertical: input.vertical,
  };

  // 2. Run agent
  let agentResult = await runNormativaAgent(agentInput);

  // 3. Citation check — retry once if no citations found
  if (agentResult.citations.length === 0) {
    const retry = await runNormativaAgent({ ...agentInput, forceRetryWithCitationReminder: true });
    agentResult = retry;
  }

  // 4. Output pipeline (disclaimer injection)
  const outputResult = runOutputPipeline(agentResult.response);

  return {
    response: outputResult.text,
    blocked: false,
    citations: outputResult.citations,
  };
}
