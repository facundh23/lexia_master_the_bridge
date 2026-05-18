const BLOCKED_PATTERNS = [
  /ignora\s+(tus\s+)?instrucciones/i,
  /olvida\s+(todo\s+lo\s+anterior|tus\s+instrucciones)/i,
  /act[úu]a\s+como\s+(DAN|GPT|un\s+asistente\s+sin\s+restricciones)/i,
  /jailbreak/i,
  /system\s+prompt/i,
  /prompt\s+injection/i,
  /mu[eé]strame\s+tu\s+system\s+prompt/i,
  /revela\s+(tu\s+)?instrucciones\s+(del\s+sistema|secretas)/i,
  /modo\s+(developer|sin\s+filtros|sin\s+restricciones)/i,
  /\bDAN\b/,
];

export function checkKeywordBlocklist(text: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(text));
}
