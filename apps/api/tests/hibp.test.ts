import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

vi.mock('hibp', () => ({
  pwnedPassword: vi.fn().mockImplementation(async (password: string) => {
    if (password === 'password123') return 5;
    return 0;
  }),
}));

vi.stubEnv('NODE_ENV', 'development');

describe('HIBP password check', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a pwned password during sign-up', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: 'hibp@lexia.local',
        password: 'password123',
        name: 'HIBP Test',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('HIBP_PWNED');
  });

  it('allows a non-pwned password during sign-up', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: `safe-${Date.now()}@lexia.local`,
        password: 'SafeUniquePassword999!',
        name: 'Safe User',
      },
    });

    // 200 from Better Auth (sign-up success) or any non-400 — not rejected by HIBP
    expect(response.statusCode).not.toBe(400);
  });
});
