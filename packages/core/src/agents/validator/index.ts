import { ChatAnthropic } from '@langchain/anthropic';
import { z } from 'zod';

const VALIDATOR_PROMPT = `You are a compliance validator for a Spanish immigration information assistant (Lexia).
Review the following response and verify ALL conditions:
1. CITATIONS: Contains at least one specific legal citation (e.g. "Art. 22 del Código Civil", "RD 557/2011 art. X", "Ley Orgánica X")
2. NO LEGAL ADVICE: Does NOT make personal recommendations like "en tu caso debes", "te recomiendo que presentes", "deberías contratar". General informational statements are OK.
3. NO PII: Does NOT contain emails, Spanish DNI/NIE numbers, phone numbers, or IBANs.
Respond ONLY with JSON: {"valid": boolean, "reason": string}`;

const ValidatorSchema = z.object({
  valid: z.boolean(),
  reason: z.string(),
});

export interface ValidatorResult {
  valid: boolean;
  reason: string;
}

export async function runValidatorAgent(
  response: string,
  route: string,
): Promise<ValidatorResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || route === 'out_of_scope') {
    return { valid: true, reason: 'skipped' };
  }

  try {
    const model = new ChatAnthropic({
      model: process.env.VALIDATOR_MODEL ?? 'claude-haiku-4-5-20251001',
      apiKey,
      temperature: 0,
    }).withStructuredOutput(ValidatorSchema);

    return await model.invoke([
      { role: 'user', content: `${VALIDATOR_PROMPT}\n\nResponse to validate:\n${response}` },
    ]);
  } catch (err) {
    // Fail-secure: ante error del validator (timeout, rate-limit), rechazar la respuesta
    console.error('[validator] error — fail-secure reject applied:', String(err));
    return { valid: false, reason: 'validator_error_fail_secure' };
  }
}
