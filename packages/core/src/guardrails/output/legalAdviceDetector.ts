const LEGAL_ADVICE_PATTERNS = [
  /\ben tu (caso|situación),?\s+(debes|deberías|tienes que)\b/i,
  /\bte recomiendo (personalmente )?que\b/i,
  /\blo que debes hacer es\b/i,
  /\bmi (consejo|recomendación) (personal )?es que\b/i,
  /\bnecesitas urgentemente (un abogado|contratar|presentar)\b/i,
  /\bdeberías contratar (a )?(un|una) (abogado|gestora?)\b/i,
];

export function detectLegalAdvice(text: string): boolean {
  return LEGAL_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}
