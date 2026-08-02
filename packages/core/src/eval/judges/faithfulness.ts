import { ChatAnthropic } from '@langchain/anthropic';

export interface FaithfulnessInput {
  response: string;
  contexts: string[];
  systemPrompt?: string;
}

export interface RagasJudgeResult {
  score: number;
  rationale: string;
}

const PROMPT = `Eres un evaluador de sistemas RAG. Mide si cada afirmación de la respuesta está respaldada por las fuentes disponibles: el prompt del sistema (conocimiento estático de confianza) y los contextos recuperados dinámicamente.

{systemPromptSection}

CONTEXTOS RECUPERADOS:
{contexts}

RESPUESTA DEL SISTEMA:
{response}

Rúbrica: una afirmación es fiel si aparece en CUALQUIERA de las dos fuentes anteriores.
- 1.0: Todas las afirmaciones están respaldadas
- 0.7: La mayoría respaldada, alguna imprecisión menor
- 0.4: Varias afirmaciones no están en ninguna fuente
- 0.0: Afirmaciones que contradicen o no aparecen en ninguna fuente

Devuelve SOLO JSON válido: {"score": <0-1>, "rationale": "<una oración>"}`;

export async function runFaithfulnessJudge(input: FaithfulnessInput): Promise<RagasJudgeResult> {
  const model = new ChatAnthropic({
    model: process.env.EVAL_JUDGE_MODEL ?? 'claude-haiku-4-5-20251001',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
  });

  const contextsText = input.contexts.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');
  const systemPromptSection = input.systemPrompt
    ? `PROMPT DEL SISTEMA (fuente de confianza estática):\n${input.systemPrompt.slice(0, 6000)}\n`
    : '';
  const prompt = PROMPT
    .replace('{systemPromptSection}', systemPromptSection)
    .replace('{contexts}', contextsText.slice(0, 3000))
    .replace('{response}', input.response.slice(0, 1500));

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
