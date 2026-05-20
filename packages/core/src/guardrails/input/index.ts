import { redactPII } from './regexPIIRedactor.js';
import { checkKeywordBlocklist } from './keywordBlocklist.js';
import { llmJudgeJailbreak } from './llmJudgeJailbreak.js';

export type BlockReason = 'jailbreak_attempt' | 'pii_detected' | 'special_category_detected' | 'budget_exceeded';

export interface InputPipelineResult {
  sanitized: string;
  blocked: boolean;
  reason?: BlockReason;
  hadPII: boolean;
  hadSpecialCategory: boolean;
}

export async function runInputPipeline(text: string): Promise<InputPipelineResult> {
  // Step 1: Regex PII redaction
  const sanitized1 = redactPII(text);
  const hadPII = sanitized1 !== text;

  // Step 2: Keyword blocklist (sync, fast)
  if (checkKeywordBlocklist(sanitized1)) {
    return { sanitized: sanitized1, blocked: true, reason: 'jailbreak_attempt', hadPII, hadSpecialCategory: false };
  }

  // Step 3: LLM-judge jailbreak (async, Haiku)
  const isLlmJailbreak = await llmJudgeJailbreak(sanitized1);
  if (isLlmJailbreak) {
    return { sanitized: sanitized1, blocked: true, reason: 'jailbreak_attempt', hadPII, hadSpecialCategory: false };
  }

  return { sanitized: sanitized1, blocked: false, hadPII, hadSpecialCategory: false };
}
