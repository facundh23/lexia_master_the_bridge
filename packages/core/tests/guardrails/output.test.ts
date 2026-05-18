import { describe, it, expect } from 'vitest';
import { checkForCitations } from '../../src/guardrails/output/citationEnforcer.js';
import { injectDisclaimer } from '../../src/guardrails/output/disclaimerInjector.js';
import { runOutputPipeline } from '../../src/guardrails/output/index.js';

describe('checkForCitations', () => {
  it('detects BOE citation', () => {
    expect(checkForCitations('Según el [BOE 30/04/2011] el plazo es 10 años').hasCitations).toBe(
      true,
    );
  });

  it('detects Código Civil citation', () => {
    expect(checkForCitations('El Art. 22 del Código Civil establece que...').hasCitations).toBe(
      true,
    );
  });

  it('detects RD citation', () => {
    expect(checkForCitations('El RD 557/2011 regula...').hasCitations).toBe(true);
  });

  it('detects Artículo keyword', () => {
    expect(checkForCitations('Artículo 22 establece un período de 10 años.').hasCitations).toBe(
      true,
    );
  });

  it('returns false when no citations', () => {
    expect(checkForCitations('El plazo es de 10 años.').hasCitations).toBe(false);
  });

  it('extracts citation list', () => {
    const result = checkForCitations('Según [BOE 2011] y el Art. 22 CC...');
    expect(result.citations.length).toBeGreaterThan(0);
  });
});

describe('injectDisclaimer', () => {
  it('appends disclaimer at end of text', () => {
    const result = injectDisclaimer('El plazo es 10 años. [BOE 2011]');
    expect(result).toContain('El plazo es 10 años. [BOE 2011]');
    expect(result).toContain('NO sustituye');
    expect(result).toContain('Lexia es un asistente informativo');
  });

  it('does not duplicate disclaimer if already present', () => {
    const withDisclaimer = injectDisclaimer('Texto.');
    const result = injectDisclaimer(withDisclaimer);
    const count = (result.match(/NO sustituye/g) ?? []).length;
    expect(count).toBe(1);
  });
});

describe('runOutputPipeline', () => {
  it('always injects disclaimer', () => {
    const result = runOutputPipeline('Respuesta sin citas.');
    expect(result.text).toContain('NO sustituye');
  });

  it('returns text with citations untouched', () => {
    const result = runOutputPipeline('Según Art. 22 CC el plazo es 10 años.');
    expect(result.text).toContain('Art. 22 CC');
  });

  it('flags missing citations', () => {
    const result = runOutputPipeline('El plazo es 10 años sin ninguna cita.');
    expect(result.hasCitations).toBe(false);
  });

  it('reports has citations when present', () => {
    const result = runOutputPipeline('Según Art. 22 CC el plazo es 10 años.');
    expect(result.hasCitations).toBe(true);
  });
});
