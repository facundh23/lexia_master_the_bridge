export const LEXIA_CORE_VERSION = '0.3.0';
export * from './storage/index.js';
export * from './vertical/index.js';
export * from './rag/index.js';
export * from './guardrails/input/index.js';
export * from './guardrails/output/index.js';
export * from './agents/index.js';
export { runLexiaCore } from './lexiaCore.js';
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
