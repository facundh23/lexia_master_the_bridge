import { describe, it, expect } from 'vitest';
import { NORMATIVA_SYSTEM_PROMPT } from '../../src/agents/normativa/prompt.js';
import { ELIGIBILITY_SYSTEM_PROMPT } from '../../src/agents/eligibility/prompt.js';

describe('system prompts', () => {
  it('normativa prompt is a non-empty string', () => {
    expect(typeof NORMATIVA_SYSTEM_PROMPT).toBe('string');
    expect(NORMATIVA_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('eligibility prompt is a non-empty string', () => {
    expect(typeof ELIGIBILITY_SYSTEM_PROMPT).toBe('string');
    expect(ELIGIBILITY_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it('normativa prompt contains canary comment format when env token starts with LEXIA_CANARY', () => {
    // The canary is injected at module load time using process.env.LEXIA_CANARY_TOKEN.
    // Without the env var, the prompt should NOT contain '<!--'.
    // With the env var, it should. We test the no-env case (default in test environment).
    if (!process.env.LEXIA_CANARY_TOKEN) {
      expect(NORMATIVA_SYSTEM_PROMPT).not.toContain('<!--');
    } else {
      expect(NORMATIVA_SYSTEM_PROMPT).toContain('<!--');
      expect(NORMATIVA_SYSTEM_PROMPT).toContain(process.env.LEXIA_CANARY_TOKEN);
    }
  });
});
