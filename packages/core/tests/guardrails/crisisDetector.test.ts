import { describe, it, expect } from 'vitest';
import {
  detectCrisis,
  CRISIS_RESOURCES_BLOCK,
} from '../../src/guardrails/input/crisisDetector.js';

describe('detectCrisis', () => {
  it('returns no crisis for normal immigration query', () => {
    const result = detectCrisis('¿Cuántos años necesito para la nacionalidad?');
    expect(result.hasCrisis).toBe(false);
  });

  it('detects imminent deportation', () => {
    const result = detectCrisis('Me van a deportar en 3 días ¿qué puedo hacer?');
    expect(result.hasCrisis).toBe(true);
    expect(result.crisisType).toBe('deportation_imminent');
  });

  it('detects gender violence signal', () => {
    const result = detectCrisis('Hay violencia en casa y me amenazan ¿tengo derechos?');
    expect(result.hasCrisis).toBe(true);
    expect(result.crisisType).toBe('gender_violence');
  });

  it('detects homelessness', () => {
    const result = detectCrisis('Estoy en la calle sin alojamiento desde ayer');
    expect(result.hasCrisis).toBe(true);
    expect(result.crisisType).toBe('no_housing');
  });

  it('detects unaccompanied minor signal', () => {
    const result = detectCrisis('Mi hijo menor está solo sin documentos en España');
    expect(result.hasCrisis).toBe(true);
    expect(result.crisisType).toBe('unaccompanied_minor');
  });

  it('CRISIS_RESOURCES_BLOCK contains CEAR and 016', () => {
    expect(CRISIS_RESOURCES_BLOCK).toContain('CEAR');
    expect(CRISIS_RESOURCES_BLOCK).toContain('016');
    expect(CRISIS_RESOURCES_BLOCK).toContain('Cruz Roja');
  });
});
