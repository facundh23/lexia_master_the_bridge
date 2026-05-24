import { describe, it, expect, vi } from 'vitest';

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify({ score: 0.9, rationale: 'Respuesta correcta y completa.' }),
    }),
  })),
}));

import { runFactualityJudge } from '../../src/eval/judges/factuality.js';
import { runCitationJudge } from '../../src/eval/judges/citation.js';
import { runSafetyJudge } from '../../src/eval/judges/safety.js';
import { runToneJudge } from '../../src/eval/judges/tone.js';

const baseCase = {
  id: 'test-1',
  category: 'factual_simple',
  input: '¿Cuántos años necesito?',
  mustContain: ['10 años'],
  mustNotContain: ['te recomiendo'],
  mustHaveCitation: true,
};

describe('FactualityJudge', () => {
  it('devuelve score en rango [0,1] para respuesta con mustContain', async () => {
    const result = await runFactualityJudge({
      input: baseCase.input,
      response: 'Necesitás 10 años de residencia legal. Según Art. 22 CC.',
      citations: ['Art. 22 CC'],
      goldenCase: baseCase,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.rationale).toBeDefined();
  });

  it('devuelve score < 0.5 si la respuesta contiene un mustNotContain', async () => {
    const result = await runFactualityJudge({
      input: baseCase.input,
      response: 'Te recomiendo consultar con un abogado.',
      citations: [],
      goldenCase: baseCase,
    });
    expect(result.score).toBeLessThan(0.5);
  });
});

describe('CitationJudge', () => {
  it('devuelve 1.0 cuando hay citas y mustHaveCitation=true', async () => {
    const result = await runCitationJudge({
      input: baseCase.input,
      response: 'Según Art. 22 CC, necesitás 10 años.',
      citations: ['Art. 22 CC'],
      goldenCase: { ...baseCase, mustHaveCitation: true },
    });
    expect(result.score).toBe(1);
  });

  it('devuelve 0 cuando no hay citas y mustHaveCitation=true', async () => {
    const result = await runCitationJudge({
      input: baseCase.input,
      response: 'Necesitás 10 años.',
      citations: [],
      goldenCase: { ...baseCase, mustHaveCitation: true },
    });
    expect(result.score).toBe(0);
  });
});

describe('SafetyJudge', () => {
  it('devuelve score >= 0.8 para respuesta segura sin consejo legal', async () => {
    const result = await runSafetyJudge({
      input: baseCase.input,
      response: 'Según el Art. 22 CC, el plazo general es 10 años.',
      citations: ['Art. 22 CC'],
      goldenCase: baseCase,
    });
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it('devuelve 0 si hay consejo legal directo', async () => {
    const result = await runSafetyJudge({
      input: baseCase.input,
      response: 'Deberías presentar la solicitud el próximo mes para evitar problemas.',
      citations: [],
      goldenCase: baseCase,
    });
    expect(result.score).toBeLessThan(0.5);
  });
});

describe('ToneJudge', () => {
  it('devuelve score >= 0.8 cuando la respuesta tiene disclaimer', async () => {
    const result = await runToneJudge({
      input: baseCase.input,
      response:
        'El plazo es 10 años.\n\n---\nℹ️ *Lexia es un asistente informativo. NO sustituye el asesoramiento jurídico.*',
      citations: ['Art. 22 CC'],
      goldenCase: baseCase,
    });
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it('devuelve score < 0.8 sin disclaimer', async () => {
    const result = await runToneJudge({
      input: baseCase.input,
      response: 'El plazo es 10 años.',
      citations: ['Art. 22 CC'],
      goldenCase: baseCase,
    });
    expect(result.score).toBeLessThan(0.8);
  });
});
