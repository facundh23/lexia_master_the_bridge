import { ChatAnthropic } from '@langchain/anthropic';

export interface JudgeInput {
  input: string;
  response: string;
  citations: string[];
  goldenCase: {
    category?: string;
    mustContain: string[];
    mustNotContain: string[];
    mustHaveCitation: boolean;
  };
}

export interface JudgeResult {
  score: number; // 0-1
  rationale: string;
}

const FACTUALITY_PROMPT = `Eres un juez de calidad para un asistente informativo de extranjería español.
Evalúa la respuesta del asistente según la siguiente rúbrica (devuelve SOLO JSON válido):

Pregunta del usuario: {input}
Respuesta del asistente: {response}

Rúbrica:
- 1.0: Respuesta factualmente correcta, completa, sin afirmaciones incorrectas.
- 0.7: Mayormente correcta, alguna imprecisión menor que no induce a error.
- 0.4: Parcialmente correcta o incompleta de forma significativa.
- 0.0: Incorrecta, engañosa o claramente incompleta.

Devuelve exactamente: {"score": <número entre 0 y 1>, "rationale": "<una oración de justificación>"}`;

export async function runFactualityJudge(input: JudgeInput): Promise<JudgeResult> {
  const lowerResponse = input.response.toLowerCase();
  for (const banned of input.goldenCase.mustNotContain) {
    if (lowerResponse.includes(banned.toLowerCase())) {
      return { score: 0.1, rationale: `Contiene texto prohibido: "${banned}"` };
    }
  }

  const allPresent = input.goldenCase.mustContain.every((term) =>
    lowerResponse.includes(term.toLowerCase()),
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      score: allPresent ? 0.85 : 0.4,
      rationale: allPresent
        ? 'Contiene todos los términos esperados (evaluación determinista — sin API key).'
        : 'Faltan términos esperados (evaluación determinista — sin API key).',
    };
  }

  const model = new ChatAnthropic({
    model: process.env.EVAL_JUDGE_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey,
    temperature: 0,
  });

  const prompt = FACTUALITY_PROMPT.replace('{input}', input.input).replace(
    '{response}',
    input.response.slice(0, 2000),
  );

  try {
    const result = await model.invoke(prompt);
    const content =
      typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      score: Math.max(0, Math.min(1, Number(parsed.score ?? 0.5))),
      rationale: String(parsed.rationale ?? 'Sin justificación del juez.'),
    };
  } catch {
    return {
      score: allPresent ? 0.8 : 0.4,
      rationale: 'Fallback determinista (error en LLM judge).',
    };
  }
}
