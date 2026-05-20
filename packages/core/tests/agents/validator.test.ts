import { describe, it, expect, vi } from 'vitest';

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ valid: true, reason: 'all_checks_passed' }),
    }),
  })),
}));

import { runValidatorAgent } from '../../src/agents/validator/index.js';
import { ChatAnthropic } from '@langchain/anthropic';

describe('runValidatorAgent', () => {
  it('validates a compliant response', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const response = 'Según el Art. 22 del Código Civil, necesitas 10 años de residencia.';
    const result = await runValidatorAgent(response, 'normativa');
    expect(result.valid).toBe(true);
  });

  it('returns invalid for a response with no citations (simulated)', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    vi.mocked(ChatAnthropic).mockImplementationOnce(
      () =>
        ({
          withStructuredOutput: vi.fn().mockReturnValue({
            invoke: vi.fn().mockResolvedValue({ valid: false, reason: 'no_citations_found' }),
          }),
        }) as never,
    );
    const result = await runValidatorAgent('Necesitas residir en España.', 'normativa');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('no_citations_found');
  });

  it('skips validation for out_of_scope route', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const result = await runValidatorAgent('Lo siento, está fuera del ámbito.', 'out_of_scope');
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('skipped');
  });

  it('fails-open when API key is missing', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const result = await runValidatorAgent('cualquier respuesta', 'normativa');
    expect(result.valid).toBe(true);
    process.env.ANTHROPIC_API_KEY = original;
  });
});
