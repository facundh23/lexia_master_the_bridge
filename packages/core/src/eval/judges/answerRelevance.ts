import { ChatAnthropic } from '@langchain/anthropic';
import type { RagasJudgeResult } from './faithfulness.js';

export interface AnswerRelevanceInput {
  question: string;
  response: string;
}

const PROMPT = `Eres un evaluador de sistemas RAG. Mide si la respuesta responde directamente la pregunta.

PREGUNTA:
{question}

RESPUESTA:
{response}

Rúbrica:
- 1.0: Responde directa y completamente la pregunta
- 0.7: Responde pero incluye información innecesaria o es incompleta
- 0.4: Responde parcialmente o se desvía del tema
- 0.0: No responde la pregunta o es irrelevante

Devuelve SOLO JSON válido: {"score": <0-1>, "rationale": "<una oración>"}`;

export async function runAnswerRelevanceJudge(input: AnswerRelevanceInput): Promise<RagasJudgeResult> {
  const model = new ChatAnthropic({
    model: process.env.EVAL_JUDGE_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const prompt = PROMPT
    .replace('{question}', input.question)
    .replace('{response}', input.response.slice(0, 2000));

  try {
    const result = await model.invoke(prompt);
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      score: Math.max(0, Math.min(1, Number(parsed.score ?? 0.5))),
      rationale: String(parsed.rationale ?? 'Sin justificación.'),
    };
  } catch {
    return { score: 0.5, rationale: 'Fallback — error en LLM judge.' };
  }
}
