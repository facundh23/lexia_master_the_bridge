import { redactPII } from './regexPIIRedactor.js';
import { checkKeywordBlocklist } from './keywordBlocklist.js';

export type BlockReason = 'jailbreak_attempt' | 'pii_detected';

export interface InputPipelineResult {
  sanitized: string;
  blocked: boolean;
  reason?: BlockReason;
  hadPII: boolean;
}

export function runInputPipeline(text: string): InputPipelineResult {
  if (checkKeywordBlocklist(text)) {
    return { sanitized: text, blocked: true, reason: 'jailbreak_attempt', hadPII: false };
  }

  const sanitized = redactPII(text);
  const hadPII = sanitized !== text;

  return { sanitized, blocked: false, hadPII };
}
