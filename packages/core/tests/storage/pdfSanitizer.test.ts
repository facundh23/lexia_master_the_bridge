import { describe, it, expect } from 'vitest';
import { sanitizePdf, MAX_PDF_SIZE_BYTES } from '../../src/storage/pdfSanitizer.js';

function makePdfBuffer(extraContent = ''): Buffer {
  return Buffer.from(`%PDF-1.4\n%fake-pdf-content-for-test${extraContent}\n%%EOF`);
}

describe('sanitizePdf', () => {
  it('accepts a clean PDF buffer', () => {
    const result = sanitizePdf(makePdfBuffer());
    expect(result.safe).toBe(true);
  });

  it('rejects a non-PDF buffer', () => {
    const result = sanitizePdf(Buffer.from('this is not a pdf'));
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('NOT_A_PDF');
  });

  it('rejects a PDF containing /JavaScript', () => {
    const result = sanitizePdf(makePdfBuffer('\n/JavaScript << /S /JavaScript /JS (alert(1)) >>'));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('DANGEROUS_CONTENT');
  });

  it('rejects a PDF containing /Launch', () => {
    const result = sanitizePdf(makePdfBuffer('\n/Launch << /S /Launch /Win << /F (cmd.exe) >> >>'));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('DANGEROUS_CONTENT');
  });

  it('accepts a PDF containing benign /Font keyword', () => {
    const result = sanitizePdf(makePdfBuffer('\n/Font << /F1 12 0 R >>'));
    expect(result.safe).toBe(true);
  });

  it('MAX_PDF_SIZE_BYTES is 10MB', () => {
    expect(MAX_PDF_SIZE_BYTES).toBe(10 * 1024 * 1024);
  });
});
