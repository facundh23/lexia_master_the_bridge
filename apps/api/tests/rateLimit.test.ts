import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Rate limiting', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://lexia:lexia_dev_password@localhost:5432/lexia';
    process.env.BETTER_AUTH_SECRET =
      'test_secret_64_chars_minimum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health no tiene rate limit restrictivo (permite 5 requests rápidos)', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).not.toBe(429);
    }
  });

  it('La respuesta no falla con error interno en rutas con rate limit activo', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBeLessThan(500);
  });
});
