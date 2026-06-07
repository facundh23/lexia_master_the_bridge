import { ChatAnthropic } from '@langchain/anthropic';
import { z } from 'zod';

const NORMATIVA_VALIDATOR_PROMPT = `You are a compliance validator for a Spanish immigration information assistant (Lexia).
Review the following response and verify ALL conditions:
1. CITATIONS: Contains at least one reference to a specific Spanish legal source. This includes: article numbers (e.g. "Art. 22 del Código Civil"), regulations (e.g. "RD 557/2011", "RD 1004/2015"), laws (e.g. "Ley Orgánica 4/2000"), international conventions (e.g. "Convenio de La Haya"), or official instructions (e.g. "Instrucción DGRN"). A general mention like "según la normativa vigente" WITHOUT naming a specific law is NOT sufficient.
2. NO LEGAL ADVICE: Does NOT make substantive legal recommendations about what legal action the user should take in their specific case (e.g. "en tu caso debes presentar recurso", "te recomiendo que solicites la tarjeta de residencia", "deberías contratar un abogado para impugnar"). IMPORTANT: Referrals to professionals or official bodies are NOT legal advice and are ALWAYS allowed — phrases like "te recomiendo consultar con un abogado", "puedes consultar con el Registro Civil", "es aconsejable verificar con el consulado" are compliant professional referrals, not legal advice.
3. NO PII: Does NOT contain emails, Spanish DNI/NIE numbers, phone numbers, or IBANs.
Respond ONLY with JSON: {"valid": boolean, "reason": string}`;

const ELIGIBILITY_VALIDATOR_PROMPT = `You are a compliance validator for a Spanish immigration eligibility assistant (Lexia).
The response being validated is an eligibility evaluation — it is expected to address the user's personal situation directly.
Review the following response and verify ONLY these conditions:
1. CITATIONS: Contains at least one specific legal citation (e.g. "Art. 22 del Código Civil", "Art. 22.1 CC")
2. NO PII: Does NOT contain emails, Spanish DNI/NIE numbers, phone numbers, or IBANs.
NOTE: Personal eligibility assessments ("en tu caso ya cumples", "según los datos proporcionados") are ALLOWED and expected in this context.
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

    const prompt = route === 'eligibility' ? ELIGIBILITY_VALIDATOR_PROMPT : NORMATIVA_VALIDATOR_PROMPT;

    return await model.invoke([
      { role: 'user', content: `${prompt}\n\nResponse to validate:\n${response}` },
    ]);
  } catch (err) {
    // Fail-secure: ante error del validator (timeout, rate-limit), rechazar la respuesta
    console.error('[validator] error — fail-secure reject applied:', String(err));
    return { valid: false, reason: 'validator_error_fail_secure' };
  }
}
