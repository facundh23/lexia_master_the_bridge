export const LEXIA_CORE_VERSION = '0.3.0';
export * from './storage/index.js';
export * from './vertical/index.js';
export * from './rag/index.js';
export * from './guardrails/input/index.js';
export * from './guardrails/output/index.js';
export * from './agents/index.js';
export { runLexiaCore, runLexiaCoreStream } from './lexiaCore.js';
export type { LexiaCoreInput, LexiaCoreResult } from './lexiaCore.js';
export { encryptField, decryptField, isEncrypted } from './crypto/fieldEncryption.js';

// Fase 4 — new exports
export * from './nhi/agentIdentities.js';
export * from './guardrails/input/crisisDetector.js';
export * from './agents/validator/index.js';
export * from './budget/tokenBudget.js';
export { requestHumanReview } from './tools/requestHumanReview.js';
export type { HumanReviewInput, HumanReviewResult } from './tools/requestHumanReview.js';

// Fase 6 — vertical manifests
export { nacionalidadResidencia } from './verticals/nacionalidad_residencia/manifest.js';

// Prompts (para eval)
export { NORMATIVA_SYSTEM_PROMPT } from './agents/normativa/prompt.js';

// Fase 7 — eval pipeline
export { runEval } from './eval/runner.js';
export type { GoldenSet, GoldenCase, EvalRunResult, EvalMetrics, EvalRunOptions } from './eval/runner.js';
export * from './eval/judges/index.js';
