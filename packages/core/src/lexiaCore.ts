import { runInputPipeline } from './guardrails/input/index.js';
import { runOutputPipeline } from './guardrails/output/index.js';
import { runOrchestrator, runOrchestratorStream } from './agents/orchestrator/index.js';
import { startTrace } from './observability/langfuse.js';
import { detectCrisis, CRISIS_RESOURCES_BLOCK } from './guardrails/input/crisisDetector.js';
import { logAgentAction } from './nhi/auditLogger.js';
import type { BlockReason } from './guardrails/input/index.js';
import type { CaseData, Route } from './agents/orchestrator/state.js';
import { createDb } from '@lexia/db';
import { checkBudget, recordUsage } from './budget/tokenBudget.js';

let _coreDb: ReturnType<typeof createDb> | null = null;
function getCoreDb() {
  if (!_coreDb && process.env.DATABASE_URL) _coreDb = createDb(process.env.DATABASE_URL);
  return _coreDb;
}

const CANNED_RESPONSES: Record<BlockReason, string> = {
  jailbreak_attempt:
    'Lo siento, no puedo procesar esa solicitud. Estoy diseñado para ayudarte con información sobre la nacionalidad española por residencia. ¿Tienes alguna pregunta sobre ese tema?\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*',
  pii_detected:
    'He detectado información personal sensible en tu mensaje. He eliminado esos datos antes de procesarlo. Por favor, evita incluir documentos de identidad, números de cuenta u otra información personal en tus consultas.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*',
  special_category_detected:
    'He detectado información de categoría especial en tu consulta. Por protección de tus datos, no persisto esta información. Por favor, reformula tu pregunta sin incluir datos sensibles de identidad personal.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*',
  budget_exceeded:
    'Has alcanzado el límite gratuito de consultas para este mes (50.000 tokens). Tu cuota se restablecerá el primer día del próximo mes.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico de un abogado o gestor habilitado.*',
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

export async function runLexiaCoreStream(
  input: LexiaCoreInput,
  onToken: (token: string) => void,
): Promise<LexiaCoreResult> {
  const trace = await startTrace({
    userId: input.userId,
    content: input.content,
    vertical: input.vertical,
  });

  const coreDb = getCoreDb();
  if (coreDb) {
    const budget = await checkBudget(input.userId, coreDb);
    if (!budget.allowed) {
      onToken(CANNED_RESPONSES.budget_exceeded);
      trace.end({ response: 'budget_exceeded', route: 'blocked', citations: [] });
      return {
        response: CANNED_RESPONSES.budget_exceeded,
        blocked: true,
        blockReason: 'budget_exceeded',
        citations: [],
        traceId: trace.traceId,
      };
    }
  }

  const crisisResult = detectCrisis(input.content);

  const guardSpan = trace.span('input_guardrails');
  const inputResult = await runInputPipeline(input.content);
  guardSpan.end({ blocked: inputResult.blocked, hadPII: (inputResult as any).hadPII });

  if (inputResult.blocked) {
    const cannedResponse = CANNED_RESPONSES[inputResult.reason!];
    onToken(cannedResponse);
    trace.end({ response: 'blocked', route: 'blocked', citations: [] });
    return {
      response: cannedResponse,
      blocked: true,
      blockReason: inputResult.reason,
      citations: [],
      traceId: trace.traceId,
    };
  }

  const orchSpan = trace.span('orchestrator');
  const orchestratorResult = await runOrchestratorStream(
    {
      content: inputResult.sanitized,
      conversationHistory: input.conversationHistory,
      userId: input.userId,
      vertical: input.vertical,
      caseData: input.caseData,
    },
    onToken,
  );
  orchSpan.end({
    route: orchestratorResult.route,
    citationsCount: orchestratorResult.citations.length,
  });

  const outputResult = runOutputPipeline(orchestratorResult.response);

  const finalResult: LexiaCoreResult = {
    response: outputResult.text,
    blocked: false,
    citations:
      outputResult.citations.length > 0 ? outputResult.citations : orchestratorResult.citations,
    route: orchestratorResult.route,
    traceId: trace.traceId,
  };

  if (crisisResult.hasCrisis) {
    finalResult.response = CRISIS_RESOURCES_BLOCK + finalResult.response;
    await logAgentAction({
      agentId: 'system:crisis_detector:v1',
      action: 'escalation_risk',
      userId: input.userId,
      traceId: trace.traceId,
      scopeUsed: 'read:input',
      details: { crisisType: crisisResult.crisisType },
    });
  }

  if (coreDb) {
    const estimatedTokens = Math.ceil((input.content.length + finalResult.response.length) / 4);
    await recordUsage(input.userId, estimatedTokens, coreDb).catch(() => {});
  }

  trace.end({
    response: finalResult.response,
    route: finalResult.route ?? 'unknown',
    citations: finalResult.citations,
  });

  return finalResult;
}

export async function runLexiaCore(input: LexiaCoreInput): Promise<LexiaCoreResult> {
  const trace = await startTrace({
    userId: input.userId,
    content: input.content,
    vertical: input.vertical,
  });

  // Budget check — antes de cualquier procesamiento
  const coreDb = getCoreDb();
  if (coreDb) {
    const budget = await checkBudget(input.userId, coreDb);
    if (!budget.allowed) {
      trace.end({ response: 'budget_exceeded', route: 'blocked', citations: [] });
      return {
        response: CANNED_RESPONSES.budget_exceeded,
        blocked: true,
        blockReason: 'budget_exceeded',
        citations: [],
        traceId: trace.traceId,
      };
    }
  }

  // Detect crisis in original input (before PII redaction for better pattern matching)
  const crisisResult = detectCrisis(input.content);

  const guardSpan = trace.span('input_guardrails');
  const inputResult = await runInputPipeline(input.content);
  guardSpan.end({ blocked: inputResult.blocked, hadPII: (inputResult as any).hadPII });

  if (inputResult.blocked) {
    const result = {
      response: CANNED_RESPONSES[inputResult.reason!],
      blocked: true,
      blockReason: inputResult.reason,
      citations: [],
      traceId: trace.traceId,
    };
    trace.end({ response: 'blocked', route: 'blocked', citations: [] });
    return result;
  }

  const orchSpan = trace.span('orchestrator');
  const orchestratorResult = await runOrchestrator({
    content: inputResult.sanitized,
    conversationHistory: input.conversationHistory,
    userId: input.userId,
    vertical: input.vertical,
    caseData: input.caseData,
  });
  orchSpan.end({
    route: orchestratorResult.route,
    citationsCount: orchestratorResult.citations.length,
  });

  const outputResult = runOutputPipeline(orchestratorResult.response);

  const finalResult: LexiaCoreResult = {
    response: outputResult.text,
    blocked: false,
    citations:
      outputResult.citations.length > 0 ? outputResult.citations : orchestratorResult.citations,
    route: orchestratorResult.route,
    traceId: trace.traceId,
  };

  // Inject crisis resources if detected
  if (crisisResult.hasCrisis) {
    finalResult.response = CRISIS_RESOURCES_BLOCK + finalResult.response;
    await logAgentAction({
      agentId: 'system:crisis_detector:v1',
      action: 'escalation_risk',
      userId: input.userId,
      traceId: trace.traceId,
      scopeUsed: 'read:input',
      details: { crisisType: crisisResult.crisisType },
    });
  }

  // Record token usage (approx: chars / 4 ≈ tokens)
  if (coreDb) {
    const estimatedTokens = Math.ceil((input.content.length + finalResult.response.length) / 4);
    await recordUsage(input.userId, estimatedTokens, coreDb).catch(() => {});
  }

  trace.end({
    response: finalResult.response,
    route: finalResult.route ?? 'unknown',
    citations: finalResult.citations,
  });

  return finalResult;
}
