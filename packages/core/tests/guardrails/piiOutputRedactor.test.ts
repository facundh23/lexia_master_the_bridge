import { describe, it, expect } from 'vitest';
import { redactPIIFromOutput } from '../../src/guardrails/output/piiOutputRedactor.js';

describe('redactPIIFromOutput', () => {
  it('returns clean text unchanged', () => {
    const text = 'Para la nacionalidad española necesitas 10 años de residencia legal.';
    expect(redactPIIFromOutput(text)).toBe(text);
  });

  it('redacts email in output', () => {
    const result = redactPIIFromOutput('Puedes contactar a gestor@despacho.es para más info.');
    expect(result).not.toContain('gestor@despacho.es');
    expect(result).toContain('[EMAIL]');
  });

  it('redacts DNI in output', () => {
    const result = redactPIIFromOutput('Tu DNI es 12345678Z según el sistema.');
    expect(result).not.toContain('12345678Z');
    expect(result).toContain('[DNI]');
  });

  it('redacts Spanish phone number in output', () => {
    const result = redactPIIFromOutput('Llama al 612345678 para consultar.');
    expect(result).not.toContain('612345678');
    expect(result).toContain('[TELÉFONO]');
  });

  it('redacts NIE in output', () => {
    const result = redactPIIFromOutput('El NIE X1234567L está vigente.');
    expect(result).not.toContain('X1234567L');
    expect(result).toContain('[NIE]');
  });
});
