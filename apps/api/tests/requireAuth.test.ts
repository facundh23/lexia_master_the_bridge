import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { requireAuth } from '../src/middleware/requireAuth.js';

describe('requireAuth middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();

    // Registrar ruta de test que usa requireAuth
    app.get('/api/test/protected', { preHandler: [requireAuth] }, async (request) => ({
      userId: request.userId,
    }));

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when no session cookie is present', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/test/protected',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('UNAUTHORIZED');
  });
});
