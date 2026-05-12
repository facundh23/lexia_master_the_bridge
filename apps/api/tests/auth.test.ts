import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? '';

describe('Better Auth integration', () => {
  let app: FastifyInstance;
  const db = createDb(TEST_DB_URL);
  const testEmail = `test-${Date.now()}@lexia.local`;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('signs up a new user via /api/auth/sign-up/email', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: {
        email: testEmail,
        password: 'CorrectHorseBatteryStaple9!',
        name: 'Test User',
      },
    });

    expect(response.statusCode).toBe(200);

    const rows = await db.select().from(schema.users).where(eq(schema.users.email, testEmail));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe(testEmail);
  });
});
