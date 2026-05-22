import { describe, it, expect } from 'vitest';
import { minimizeSpecialCategories } from '../../src/guardrails/input/specialCategoryMinimizer.js';

describe('minimizeSpecialCategories', () => {
  it('returns original text unchanged for normal immigration query', () => {
    const text = '¿Cuántos años necesito para la nacionalidad española?';
    const result = minimizeSpecialCategories(text);
    expect(result.sanitized).toBe(text);
    expect(result.hadSpecialCategory).toBe(false);
  });

  it('replaces sexual orientation mentions', () => {
    const result = minimizeSpecialCategories('Soy homosexual y quiero la nacionalidad');
    expect(result.sanitized).not.toContain('homosexual');
    expect(result.sanitized).toContain('[orientación_sexual]');
    expect(result.hadSpecialCategory).toBe(true);
  });

  it('replaces religious belief mentions', () => {
    const result = minimizeSpecialCategories('Soy musulmán y practica mi religión');
    expect(result.hadSpecialCategory).toBe(true);
    expect(result.sanitized).not.toContain('musulmán');
  });

  it('replaces health data mentions', () => {
    const result = minimizeSpecialCategories('Tengo VIH y quiero saber mis derechos');
    expect(result.hadSpecialCategory).toBe(true);
    expect(result.sanitized).not.toContain('VIH');
    expect(result.sanitized).toContain('[dato_salud]');
  });

  it('preserves asylum status as relevant context (not matched by these patterns)', () => {
    const result = minimizeSpecialCategories('Soy solicitante de asilo y quiero la nacionalidad');
    expect(result.hadSpecialCategory).toBe(false);
    expect(result.sanitized).toContain('solicitante de asilo');
  });
});
