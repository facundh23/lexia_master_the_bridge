import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';

describe('Conversations + Messages API', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let conversationId: string;
  const testEmail = `conv-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Conv Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  it('POST /api/conversations — creates a conversation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
      payload: { title: 'Mi consulta de nacionalidad' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBeTruthy();
    conversationId = response.json().id as string;
  });

  it('POST /api/conversations/:id/messages — returns echo response', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: sessionCookie },
      payload: { content: '¿Cuáles son los requisitos para la nacionalidad?' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.userMessage.role).toBe('user');
    expect(body.assistantMessage.role).toBe('assistant');
    expect(body.assistantMessage.content).toContain('[eco]');
  });

  it('GET /api/conversations — lists conversations', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json())).toBe(true);
  });
});
