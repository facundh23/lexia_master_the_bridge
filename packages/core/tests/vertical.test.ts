import { describe, it, expect } from 'vitest';
import { VerticalDefinitionSchema } from '../src/vertical/definition.js';
import { getVertical, getEnabledVerticals } from '../src/vertical/registry.js';
import { nacionalidadResidencia } from '../src/verticals/nacionalidad_residencia/manifest.js';

describe('VerticalDefinitionSchema', () => {
  it('validates a valid vertical definition', () => {
    const result = VerticalDefinitionSchema.safeParse(nacionalidadResidencia);
    expect(result.success).toBe(true);
  });

  it('rejects a vertical with empty slug', () => {
    const result = VerticalDefinitionSchema.safeParse({ ...nacionalidadResidencia, slug: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a vertical with invalid slug (uppercase)', () => {
    const result = VerticalDefinitionSchema.safeParse({
      ...nacionalidadResidencia,
      slug: 'Nacionalidad',
    });
    expect(result.success).toBe(false);
  });
});

describe('registry', () => {
  it('registers nacionalidad_residencia at module load', () => {
    const vertical = getVertical('nacionalidad_residencia');
    expect(vertical).toBeDefined();
    expect(vertical?.slug).toBe('nacionalidad_residencia');
  });

  it('returns enabled verticals', () => {
    const list = getEnabledVerticals();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((v) => v.enabled)).toBe(true);
  });
});
