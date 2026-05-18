import { runInputPipeline } from './guardrails/input/index.js';
import { runOutputPipeline } from './guardrails/output/index.js';
import { runOrchestrator } from './agents/orchestrator/index.js';
import type { BlockReason } from './guardrails/input/index.js';
import type { CaseData, Route } from './agents/orchestrator/state.js';

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
  caseData?: CaseData;
}

export interface LexiaCoreResult {
  response: string;
  blocked: boolean;
  blockReason?: BlockReason;
  citations: string[];
  route?: Route;
  traceId?: string;
}

export async function runLexiaCore(input: LexiaCoreInput): Promise<LexiaCoreResult> {
  const inputResult = runInputPipeline(input.content);

  if (inputResult.blocked) {
    return {
      response: CANNED_RESPONSES[inputResult.reason!],
      blocked: true,
      blockReason: inputResult.reason,
      citations: [],
    };
  }

  const orchestratorResult = await runOrchestrator({
    content: inputResult.sanitized,
    conversationHistory: input.conversationHistory,
    userId: input.userId,
    vertical: input.vertical,
    caseData: input.caseData,
  });

  const outputResult = runOutputPipeline(orchestratorResult.response);

  return {
    response: outputResult.text,
    blocked: false,
    citations: outputResult.citations.length > 0
      ? outputResult.citations
      : orchestratorResult.citations,
    route: orchestratorResult.route,
  };
}
