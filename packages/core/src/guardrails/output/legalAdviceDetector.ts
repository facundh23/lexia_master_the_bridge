const LEGAL_ADVICE_PATTERNS = [
  /\ben tu (caso|situación),?\s+(debes|deberías|tienes que)\b/i,
  /\bte recomiendo (personalmente )?que\b/i,
  /\blo que debes hacer es\b/i,
  /\bmi (consejo|recomendación) (personal )?es que\b/i,
  /\bnecesitas urgentemente (un abogado|contratar|presentar)\b/i,
  /\bdeberías contratar (a )?(un|una) (abogado|gestora?)\b/i,
  /\bpodrías\s+(presentar|solicitar|contratar|iniciar|pedir)\b/i,
  /\ble\s+conviene\s+(solicitar|presentar|contratar|iniciar|pedir)\b/i,
  /\bla mejor opción es que\b/i,
  /\ben tu lugar (yo\s+)?(presentaría|solicitaría|contrataría|pediría|haría)\b/i,
  /\bsi fueras? tú[,]?\s+(solicitaría|presentaría|contrataría|pediría|haría)\b/i,
];

export function detectLegalAdvice(text: string): boolean {
  return LEGAL_ADVICE_PATTERNS.some((pattern) => pattern.test(text));
}
