import { describe, it, expect } from 'vitest';
import { detectLegalAdvice } from '../../src/guardrails/output/legalAdviceDetector.js';

// ---------------------------------------------------------------------------
// Casos que DEBEN ser detectados (legal advice)
// ---------------------------------------------------------------------------
describe('detectLegalAdvice — casos detectados', () => {
  it('detects "en tu caso debes presentar"', () => {
    expect(detectLegalAdvice('en tu caso debes presentar la solicitud')).toBe(true);
  });

  it('detects "en tu situación debes" variant', () => {
    expect(detectLegalAdvice('en tu situación, debes renovar antes del vencimiento')).toBe(true);
  });

  it('detects "te recomiendo que contratas un abogado"', () => {
    expect(detectLegalAdvice('te recomiendo que contratas un abogado especializado')).toBe(true);
  });

  it('detects "te recomiendo que" with direct action', () => {
    expect(detectLegalAdvice('te recomiendo que solicites la cita cuanto antes')).toBe(true);
  });

  it('detects "lo que debes hacer es"', () => {
    expect(
      detectLegalAdvice('lo que debes hacer es presentar el formulario EX-01 inmediatamente'),
    ).toBe(true);
  });

  it('detects "mi consejo es que"', () => {
    expect(detectLegalAdvice('mi consejo es que acudas a un gestor')).toBe(true);
  });

  it('detects "mi recomendación es que"', () => {
    expect(detectLegalAdvice('mi recomendación es que contrates a una asesoría')).toBe(true);
  });

  it('detects "necesitas urgentemente un abogado"', () => {
    expect(detectLegalAdvice('necesitas urgentemente un abogado para este caso')).toBe(true);
  });

  it('detects "deberías contratar un abogado"', () => {
    expect(detectLegalAdvice('deberías contratar un abogado de extranjería')).toBe(true);
  });

  it('detects "deberías contratar una gestora"', () => {
    expect(detectLegalAdvice('deberías contratar una gestora para este trámite')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Variantes coloquiales de consejo personalizado
// ---------------------------------------------------------------------------
describe('detectLegalAdvice — variantes coloquiales detectadas', () => {
  it('detects "podrías presentar la solicitud ahora"', () => {
    expect(detectLegalAdvice('podrías presentar la solicitud ahora')).toBe(true);
  });

  it('detects "le conviene solicitar la cita"', () => {
    expect(detectLegalAdvice('le conviene solicitar la cita antes del plazo')).toBe(true);
  });

  it('detects "la mejor opción es que presentes"', () => {
    expect(detectLegalAdvice('la mejor opción es que presentes la documentación ya')).toBe(true);
  });

  it('detects "en tu lugar yo presentaría"', () => {
    expect(detectLegalAdvice('en tu lugar yo presentaría la solicitud esta semana')).toBe(true);
  });

  it('detects "si fuera tú solicitaría"', () => {
    expect(detectLegalAdvice('si fuera tú solicitaría la prórroga cuanto antes')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Casos que NO deben ser detectados (información legítima)
// ---------------------------------------------------------------------------
describe('detectLegalAdvice — información legítima no detectada', () => {
  it('does not detect informational text with legal citation', () => {
    expect(
      detectLegalAdvice('según el Art. 22 CC, el plazo es de 10 años'),
    ).toBe(false);
  });

  it('does not detect general eligibility statement with "puede"', () => {
    expect(
      detectLegalAdvice('puede solicitar la nacionalidad cuando cumpla el plazo legal'),
    ).toBe(false);
  });

  it('does not detect a description of a process', () => {
    expect(
      detectLegalAdvice('el proceso de solicitud requiere estos documentos: pasaporte y NIE'),
    ).toBe(false);
  });

  it('does not detect a general explanation of requirements', () => {
    expect(
      detectLegalAdvice(
        'los solicitantes deben acreditar 10 años de residencia legal continua en España',
      ),
    ).toBe(false);
  });

  it('does not detect a plain factual statement', () => {
    expect(
      detectLegalAdvice('el plazo de resolución es de 3 meses según el RD 557/2011'),
    ).toBe(false);
  });

  it('does not detect text containing "recomendación" in a neutral context', () => {
    expect(
      detectLegalAdvice('la recomendación general es conservar los documentos originales'),
    ).toBe(false);
  });

  it('does not detect text with "consejo" in an informational context', () => {
    // "consejo" alone without the pattern "mi consejo es que" should not trigger
    expect(
      detectLegalAdvice('el Consejo de Estado emitió un dictamen sobre el plazo'),
    ).toBe(false);
  });

  it('does not detect "en tu caso" without a prescriptive verb following it', () => {
    // The pattern requires "debes|deberías|tienes que" after "en tu caso"
    expect(
      detectLegalAdvice('en tu caso, el plazo ya ha comenzado según la normativa'),
    ).toBe(false);
  });
});
