import { describe, it, expect } from 'vitest';
import { detectLegalAdvice } from '../../src/guardrails/output/legalAdviceDetector.js';

describe('detectLegalAdvice', () => {
  it('returns false for informational response with citation', () => {
    const text = 'Según el Art. 22 del Código Civil, el plazo es de 10 años de residencia legal.';
    expect(detectLegalAdvice(text)).toBe(false);
  });

  it('detects personal recommendation with "en tu caso debes"', () => {
    const text = 'En tu caso debes presentar el formulario 790 antes del martes.';
    expect(detectLegalAdvice(text)).toBe(true);
  });

  it('detects "te recomiendo que" pattern', () => {
    const text = 'Te recomiendo que solicites cita en el consulado de inmediato.';
    expect(detectLegalAdvice(text)).toBe(true);
  });

  it('detects "lo que debes hacer es" pattern', () => {
    const text = 'Lo que debes hacer es contratar un abogado urgentemente en tu situación.';
    expect(detectLegalAdvice(text)).toBe(true);
  });

  it('returns false for a general explanation', () => {
    const text =
      'Los solicitantes deben residir legalmente en España durante el período requerido.';
    expect(detectLegalAdvice(text)).toBe(false);
  });
});
