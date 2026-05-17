export const LEXIA_CORE_VERSION = '0.1.0';
export * from './storage/index.js';
export * from './vertical/index.js';
export * from './rag/index.js';
export * from './guardrails/input/index.js';
export * from './guardrails/output/index.js';
export * from './agents/index.js';
export { runLexiaCore } from './lexiaCore.js';
export type { LexiaCoreInput, LexiaCoreResult } from './lexiaCore.js';
