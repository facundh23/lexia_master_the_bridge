import type { JudgeInput, JudgeResult } from './factuality.js';

export async function runCitationJudge(input: JudgeInput): Promise<JudgeResult> {
  if (!input.goldenCase.mustHaveCitation) {
    return { score: 1, rationale: 'No se requieren citas para este caso.' };
  }

  if (input.citations.length === 0) {
    const hasCitationInText = /art\.|artículo|rd\s+\d|código civil/i.test(input.response);
    if (hasCitationInText) {
      return {
        score: 0.7,
        rationale: 'Menciona referencias legales en el texto pero no en el array de citas.',
      };
    }
    return { score: 0, rationale: 'Se requiere cita pero no hay ninguna.' };
  }

  const responseLower = input.response.toLowerCase();
  const citedInText = input.citations.some((c) =>
    responseLower.includes(c.toLowerCase().slice(0, 10)),
  );

  if (citedInText) {
    return {
      score: 1,
      rationale: `${input.citations.length} cita(s) presente(s) y referenciada(s) en el texto.`,
    };
  }

  return {
    score: 0.8,
    rationale: 'Hay citas en el array pero no se mencionan explícitamente en el texto.',
  };
}
