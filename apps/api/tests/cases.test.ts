import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';

describe('Cases API', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  const testEmail = `cases-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Cases Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('POST /api/cases — creates a case', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: { cookie: sessionCookie },
      payload: {
        verticalSlug: 'nacionalidad_residencia',
        countryOrigin: 'Argentina',
        hasChildren: false,
      },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().verticalSlug).toBe('nacionalidad_residencia');
  });

  it('GET /api/cases — lists cases for the authenticated user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/cases',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});
