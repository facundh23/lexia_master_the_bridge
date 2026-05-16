import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('GET /api/health/deep', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with preflight ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/deep' });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('ok');
    expect(response.json().preflight.ok).toBe(true);
  });
});
