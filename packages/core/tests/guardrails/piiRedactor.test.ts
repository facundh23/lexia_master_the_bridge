import { describe, it, expect } from 'vitest';
import { redactPII, detectPII } from '../../src/guardrails/input/regexPIIRedactor.js';

// ---------------------------------------------------------------------------
// DNI español
// ---------------------------------------------------------------------------
describe('redactPII — DNI español', () => {
  it('redacts DNI with uppercase letter (e.g. 12345678A)', () => {
    const result = redactPII('mi DNI es 12345678A');
    expect(result).not.toContain('12345678A');
    expect(result).toContain('[DNI]');
  });

  it('redacts DNI embedded in a sentence', () => {
    const result = redactPII('El DNI 87654321Z está caducado.');
    expect(result).not.toContain('87654321Z');
    expect(result).toContain('[DNI]');
  });

  it('redacts DNI with lowercase letter (e.g. 12345678a)', () => {
    const result = redactPII('mi DNI es 12345678a');
    expect(result).not.toContain('12345678a');
    expect(result).toContain('[DNI]');
  });
});

// ---------------------------------------------------------------------------
// NIE español
// ---------------------------------------------------------------------------
describe('redactPII — NIE español', () => {
  it('redacts NIE without hyphens (e.g. X1234567A)', () => {
    const result = redactPII('mi NIE es X1234567A');
    expect(result).not.toContain('X1234567A');
    expect(result).toContain('[NIE]');
  });

  it('redacts NIE starting with Y (e.g. Y9876543B)', () => {
    const result = redactPII('Tengo NIE Y9876543B');
    expect(result).not.toContain('Y9876543B');
    expect(result).toContain('[NIE]');
  });

  it('redacts NIE starting with Z (e.g. Z1234567C)', () => {
    const result = redactPII('NIE Z1234567C para consulta');
    expect(result).not.toContain('Z1234567C');
    expect(result).toContain('[NIE]');
  });

  it('redacts NIE with hyphens (e.g. X-1234567-A)', () => {
    const result = redactPII('mi NIE es X-1234567-A');
    expect(result).not.toContain('X-1234567-A');
    expect(result).toContain('[NIE]');
  });
});

// ---------------------------------------------------------------------------
// IBAN
// ---------------------------------------------------------------------------
describe('redactPII — IBAN', () => {
  it('redacts IBAN sin separadores (e.g. ES9121000418450200051332)', () => {
    const result = redactPII('mi cuenta ES9121000418450200051332');
    expect(result).not.toContain('ES9121000418450200051332');
    expect(result).toContain('[IBAN]');
  });

  it('redacts IBAN con espacios separando grupos', () => {
    const result = redactPII('IBAN: ES91 2100 0418 4502 0005 1332');
    expect(result).not.toContain('ES91 2100 0418 4502 0005 1332');
    expect(result).toContain('[IBAN]');
  });

  it('detects IBAN via detectPII', () => {
    expect(detectPII('IBAN ES9121000418450200051332 para transferencia')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Teléfono español
// ---------------------------------------------------------------------------
describe('redactPII — teléfono español', () => {
  it('redacts mobile number (6xx format)', () => {
    const result = redactPII('llámame al 612345678');
    expect(result).not.toContain('612345678');
    expect(result).toContain('[TELÉFONO]');
  });

  it('redacts mobile number (7xx format)', () => {
    const result = redactPII('mi número es 712345678');
    expect(result).not.toContain('712345678');
    expect(result).toContain('[TELÉFONO]');
  });

  it('redacts landline number (9xx format)', () => {
    const result = redactPII('fijo: 912345678');
    expect(result).not.toContain('912345678');
    expect(result).toContain('[TELÉFONO]');
  });

  it('redacts number with +34 prefix', () => {
    const result = redactPII('llama al +34 612345678');
    expect(result).not.toContain('612345678');
    expect(result).toContain('[TELÉFONO]');
  });

  it('detects phone via detectPII', () => {
    expect(detectPII('contacto: 698765432')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
describe('redactPII — email', () => {
  it('redacts standard email address', () => {
    const result = redactPII('escríbeme a test@example.com');
    expect(result).not.toContain('test@example.com');
    expect(result).toContain('[EMAIL]');
  });

  it('redacts email with subdomain', () => {
    const result = redactPII('contacto: usuario@mail.correo.es');
    expect(result).not.toContain('usuario@mail.correo.es');
    expect(result).toContain('[EMAIL]');
  });

  it('redacts email with plus-alias', () => {
    const result = redactPII('responde a nombre+alias@ejemplo.org');
    expect(result).not.toContain('nombre+alias@ejemplo.org');
    expect(result).toContain('[EMAIL]');
  });

  it('detects email via detectPII', () => {
    expect(detectPII('correo: info@consulado.es')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Texto limpio — sin redacción
// ---------------------------------------------------------------------------
describe('redactPII — texto limpio no modificado', () => {
  it('returns clean immigration text unchanged', () => {
    const text = 'Según el Art. 22 del Código Civil, el plazo de residencia legal es de 10 años.';
    expect(redactPII(text)).toBe(text);
  });

  it('does not redact a plain number that looks like a partial document', () => {
    const text = 'El artículo 12345678 del reglamento establece plazos.';
    // Sin letra final no es un DNI
    expect(redactPII(text)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// Pasaporte español — AAA123456 (3 letras + 6 dígitos)
// ---------------------------------------------------------------------------
describe('redactPII — pasaporte español', () => {
  it('redacts pasaporte AAA123456', () => {
    const result = redactPII('mi pasaporte es AAA123456');
    expect(result).not.toContain('AAA123456');
    expect(result).toContain('[PASAPORTE]');
  });

  it('detectPII detects pasaporte español', () => {
    expect(detectPII('mi pasaporte es AAA123456')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tarjeta de crédito
// ---------------------------------------------------------------------------
describe('redactPII — tarjeta de crédito', () => {
  it('redacts tarjeta Visa 4532123456789012', () => {
    const result = redactPII('mi tarjeta es 4532123456789012');
    expect(result).not.toContain('4532123456789012');
    expect(result).toContain('[TARJETA]');
  });

  it('redacts tarjeta con espacios "4532 1234 5678 9012"', () => {
    const result = redactPII('mi tarjeta es 4532 1234 5678 9012');
    expect(result).not.toContain('4532 1234 5678 9012');
    expect(result).toContain('[TARJETA]');
  });

  it('detectPII detects tarjeta de crédito', () => {
    expect(detectPII('tarjeta 4532123456789012')).toBe(true);
  });
});
