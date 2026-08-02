import { ChatAnthropic } from '@langchain/anthropic';
import type { RagasJudgeResult } from './faithfulness.js';

export interface ContextRecallInput {
  groundTruth: string;
  contexts: string[];
}

const PROMPT = `Eres un evaluador de sistemas RAG. Mide si los contextos recuperados contienen la información necesaria para derivar la respuesta esperada.

RESPUESTA ESPERADA (ground truth):
{groundTruth}

CONTEXTOS RECUPERADOS:
{contexts}

Analiza cada afirmación del ground truth y determina si puede derivarse de los contextos.

Rúbrica:
- 1.0: Toda la información del ground truth está cubierta por los contextos
- 0.7: La mayoría cubierta, falta algún detalle menor
- 0.4: Solo parte del ground truth está en los contextos
- 0.0: Los contextos no contienen la información necesaria

Devuelve SOLO JSON válido: {"score": <0-1>, "rationale": "<una oración>"}`;

export async function runContextRecallJudge(input: ContextRecallInput): Promise<RagasJudgeResult> {
  const model = new ChatAnthropic({
    model: process.env.EVAL_JUDGE_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const contextsText = input.contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');
  const prompt = PROMPT
    .replace('{groundTruth}', input.groundTruth)
    .replace('{contexts}', contextsText.slice(0, 3000));

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
