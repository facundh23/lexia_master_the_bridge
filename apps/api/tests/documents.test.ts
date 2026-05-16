import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

vi.mock('@lexia/core/storage', () => ({
  createMinioClient: vi.fn(() => ({
    bucketExists: vi.fn().mockResolvedValue(true),
    putObject: vi.fn().mockResolvedValue(undefined),
  })),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

const DB_URL = process.env.DATABASE_URL ?? '';

describe('Documents API', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  const testEmail = `docs-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Docs Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('POST /api/documents/upload — requires auth', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/documents/upload' });
    expect(response.statusCode).toBe(401);
  });

  it('GET /api/documents — returns empty list for new user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/documents',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
