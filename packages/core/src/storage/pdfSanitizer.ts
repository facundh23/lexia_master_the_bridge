const DANGEROUS_PATTERNS: Buffer[] = [
  Buffer.from('/JavaScript'),
  Buffer.from('/JS '),
  Buffer.from('/Launch'),
  Buffer.from('/EmbeddedFile'),
  Buffer.from('/RichMedia'),
  Buffer.from('/XFA'),
];

const PDF_MAGIC = Buffer.from('%PDF');

export interface SanitizationResult {
  safe: boolean;
  reason?: string;
}

export function sanitizePdf(buffer: Buffer): SanitizationResult {
  if (!buffer.subarray(0, 4).equals(PDF_MAGIC)) {
    return { safe: false, reason: 'NOT_A_PDF' };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (buffer.includes(pattern)) {
      return { safe: false, reason: `DANGEROUS_CONTENT:${pattern.toString().trim()}` };
    }
  }

  return { safe: true };
}

export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
