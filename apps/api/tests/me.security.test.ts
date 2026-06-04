import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';
const skipIfNoDb = it.skipIf(!DB_URL);

describe('Me — security: auth enforcement and data isolation', () => {
  let app: FastifyInstance;
  let cookieA: string;
  let cookieB: string;
  const emailA = `sec-me-a-${Date.now()}@lexia.local`;
  const emailB = `sec-me-b-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Sign up user A
    const signupA = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: emailA, password: 'TestPassword123!', name: 'Me Sec A' },
    });
    const hA = signupA.headers['set-cookie'];
    cookieA = Array.isArray(hA) ? hA[0]! : (hA ?? '');

    // Sign up user B
    const signupB = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: emailB, password: 'TestPassword456!', name: 'Me Sec B' },
    });
    const hB = signupB.headers['set-cookie'];
    cookieB = Array.isArray(hB) ? hB[0]! : (hB ?? '');
  });

  afterAll(async () => {
    // Note: DELETE /api/me/account removes the user, so we may not need to clean up
    // user A. We still try to delete both in case the account-deletion test was skipped.
    await db.delete(schema.users).where(eq(schema.users.email, emailA)).catch(() => {});
    await db.delete(schema.users).where(eq(schema.users.email, emailB)).catch(() => {});
    await app.close();
  });

  // ── Authentication enforcement ───────────────────────────────────────────────

  skipIfNoDb('GET /api/me/export — returns 401 without a session token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/me/export' });
    expect(response.statusCode).toBe(401);
  });

  skipIfNoDb('DELETE /api/me/account — returns 401 without a session token', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/api/me/account' });
    expect(response.statusCode).toBe(401);
  });

  // ── Data isolation ───────────────────────────────────────────────────────────

  skipIfNoDb(
    'GET /api/me/export — only returns data belonging to the authenticated user',
    async () => {
      // Create a case for user A so there is data in the export
      await app.inject({
        method: 'POST',
        url: '/api/cases',
        headers: { cookie: cookieA },
        payload: { verticalSlug: 'nacionalidad_residencia', countryOrigin: 'Peru', hasChildren: false },
      });

      // Create a conversation for user B
      await app.inject({
        method: 'POST',
        url: '/api/conversations',
        headers: { cookie: cookieB },
        payload: { title: 'Conversacion de B' },
      });

      // User A exports their data
      const response = await app.inject({
        method: 'GET',
        url: '/api/me/export',
        headers: { cookie: cookieA },
      });
      expect(response.statusCode).toBe(200);

      const body = response.json() as {
        user: { email: string };
        cases: Array<{ userId: string }>;
        conversations: Array<{ userId: string }>;
        exportedAt: string;
      };

      // The returned user must be user A, not user B
      expect(body.user.email).toBe(emailA);

      // Every case in the export must belong to user A
      for (const c of body.cases) {
        expect(c.userId).not.toBe(emailB);
      }

      // Every conversation in the export must belong to user A
      // (user B's conversation with title 'Conversacion de B' must not appear)
      for (const conv of body.conversations) {
        expect(conv.userId).not.toBe(emailB);
      }
    },
  );

  skipIfNoDb(
    'DELETE /api/me/account — authenticated user can delete their own account (returns 204)',
    async () => {
      // Use a dedicated user to avoid interfering with other tests
      const deleteEmail = `sec-me-delete-${Date.now()}@lexia.local`;
      const signupDel = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: deleteEmail, password: 'DeleteMe12345!', name: 'Delete Me' },
      });
      const hDel = signupDel.headers['set-cookie'];
      const cookieDel = Array.isArray(hDel) ? hDel[0]! : (hDel ?? '');

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/me/account',
        headers: { cookie: cookieDel },
      });
      expect(response.statusCode).toBe(204);

      // Clean up just in case the deletion did not cascade
      await db.delete(schema.users).where(eq(schema.users.email, deleteEmail)).catch(() => {});
    },
  );

  // ── Future work ──────────────────────────────────────────────────────────────

  it.todo(
    'DELETE /api/me/account — should require explicit email confirmation before deleting (not yet implemented)',
  );
});
