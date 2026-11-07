import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'lexia-api',
    });
  });
});

describe('CORS preflight', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // @fastify/cors >= 11 solo permite GET,HEAD,POST por defecto; la web usa PATCH y DELETE.
  it.each(['PATCH', 'DELETE'])('allows %s from the web origin', async (method) => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/me/account',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': method,
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-methods']).toContain(method);
  });
});
