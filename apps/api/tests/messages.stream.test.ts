import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const VALIDATED = 'Según el Art. 22 del Código Civil, necesitas 10 años de residencia legal.';

vi.mock('@lexia/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lexia/core')>();
  return { ...actual, runLexiaCoreStream: vi.fn() };
});

import { runLexiaCoreStream } from '@lexia/core';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';

type SseEvent = { type: string; [key: string]: unknown };

function parseSse(payload: string): SseEvent[] {
  return payload
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice('data: '.length)) as SseEvent);
}

describe('POST /api/conversations/:id/messages/stream', () => {
  let app: FastifyInstance;
  let sessionCookie: string;
  let conversationId: string;
  const testEmail = `stream-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const signup = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: testEmail, password: 'TestPassword123!', name: 'Stream Test' },
    });
    const setCookie = signup.headers['set-cookie'];
    sessionCookie = Array.isArray(setCookie) ? setCookie[0]! : (setCookie ?? '');

    const conv = await app.inject({
      method: 'POST',
      url: '/api/conversations',
      headers: { cookie: sessionCookie },
      payload: { title: 'Stream test' },
    });
    conversationId = conv.json().id as string;
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, testEmail));
    await app.close();
  });

  beforeEach(() => {
    vi.mocked(runLexiaCoreStream).mockReset();
  });

  async function postStream() {
    const response = await app.inject({
      method: 'POST',
      url: `/api/conversations/${conversationId}/messages/stream`,
      headers: { cookie: sessionCookie },
      payload: { content: '¿Cuántos años necesito?' },
    });
    return parseSse(response.payload);
  }

  it('emite las etapas en orden, después el token y done, sin replace', async () => {
    vi.mocked(runLexiaCoreStream).mockImplementation(async (_input, onToken, onStatus) => {
      onStatus?.('analyzing');
      onStatus?.('searching');
      onStatus?.('validating');
      onToken(VALIDATED);
      return { response: VALIDATED, blocked: false, citations: [], route: 'normativa' };
    });

    const events = await postStream();

    expect(events.map((e) => e.type)).toEqual(['status', 'status', 'status', 'token', 'done']);
    expect(events.filter((e) => e.type === 'status').map((e) => e.stage)).toEqual([
      'analyzing',
      'searching',
      'validating',
    ]);
    expect(events[3]).toMatchObject({ type: 'token', content: VALIDATED });
  });

  it('persiste el mensaje del asistente igual al texto emitido', async () => {
    vi.mocked(runLexiaCoreStream).mockImplementation(async (_input, onToken) => {
      onToken(VALIDATED);
      return { response: VALIDATED, blocked: false, citations: [], route: 'normativa' };
    });

    const events = await postStream();
    const done = events.find((e) => e.type === 'done')!;
    const [saved] = await db
      .select({ content: schema.messages.content })
      .from(schema.messages)
      .where(eq(schema.messages.id, done.assistantMessageId as string));

    expect(saved!.content).toBe(VALIDATED);
  });

  it('envía replace antes de done si la respuesta final difiere de lo emitido', async () => {
    const withCrisisBlock = `RECURSOS DE AYUDA\n\n${VALIDATED}`;
    vi.mocked(runLexiaCoreStream).mockImplementation(async (_input, onToken) => {
      onToken(VALIDATED);
      return { response: withCrisisBlock, blocked: false, citations: [], route: 'normativa' };
    });

    const events = await postStream();

    expect(events.map((e) => e.type)).toEqual(['token', 'replace', 'done']);
    expect(events[1]).toMatchObject({ type: 'replace', content: withCrisisBlock });
  });

  it('envía error si el core falla', async () => {
    vi.mocked(runLexiaCoreStream).mockRejectedValue(new Error('boom'));

    const events = await postStream();

    expect(events.map((e) => e.type)).toEqual(['error']);
  });
});
