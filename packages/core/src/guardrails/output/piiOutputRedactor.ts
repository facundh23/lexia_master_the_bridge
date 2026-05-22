const OUTPUT_PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[EMAIL]' },
  { pattern: /\b\d{8}[A-Z]\b/g, replacement: '[DNI]' },
  { pattern: /\b[XYZ]\d{7}[A-Z]\b/g, replacement: '[NIE]' },
  { pattern: /\b[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}[\s]?\d{10}\b/g, replacement: '[IBAN]' },
  { pattern: /\b(\+34[\s-]?)?[6789]\d{8}\b/g, replacement: '[TELÉFONO]' },
];

export function redactPIIFromOutput(text: string): string {
  let result = text;
  for (const { pattern, replacement } of OUTPUT_PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
