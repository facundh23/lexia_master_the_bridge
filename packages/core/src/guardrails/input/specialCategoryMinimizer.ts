const SPECIAL_CATEGORY_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /\b(homosexual|lesbiana|bisexual|transexual|transgénero|lgbti?q?\+?)\b/gi,
    replacement: '[orientación_sexual]',
  },
  {
    pattern: /\b(soy (musulmán|musulmana|cristiano|cristiana|judío|judía|budista|ateo|atea)|mi (religión|fe) es)\b/gi,
    replacement: '[creencia_religiosa]',
  },
  {
    pattern: /\b(soy (afiliado|militante|votante|simpatizante) (al|del|de la))\b/gi,
    replacement: '[opinión_política]',
  },
  {
    pattern: /\b(tengo (VIH|SIDA|cáncer|diabetes|epilepsia|esclerosis)|diagnóstico de [a-záéíóúñ]+)\b/gi,
    replacement: '[dato_salud]',
  },
];

export interface SpecialCategoryResult {
  sanitized: string;
  hadSpecialCategory: boolean;
}

export function minimizeSpecialCategories(text: string): SpecialCategoryResult {
  let sanitized = text;
  let hadSpecialCategory = false;

  for (const { pattern, replacement } of SPECIAL_CATEGORY_PATTERNS) {
    const replaced = sanitized.replace(pattern, replacement);
    if (replaced !== sanitized) {
      hadSpecialCategory = true;
      sanitized = replaced;
    }
  }

  return { sanitized, hadSpecialCategory };
}
