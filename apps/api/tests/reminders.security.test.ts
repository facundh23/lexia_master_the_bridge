/**
 * reminders.security.test.ts
 *
 * Security tests for the reminders API.
 *
 * KNOWN GAP: The current POST /api/reminders implementation does not verify
 * that the provided caseId belongs to the authenticated user. The test
 * "POST /api/reminders — caseId of another user is rejected with 404"
 * documents this gap. When it passes, the vulnerability has been fixed.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';
const skipIfNoDb = it.skipIf(!DB_URL);

describe('Reminders — security: ownership and auth enforcement', () => {
  let app: FastifyInstance;
  let cookieA: string;
  let cookieB: string;
  /** A case that belongs to user A */
  let caseIdA: string;
  const emailA = `sec-reminders-a-${Date.now()}@lexia.local`;
  const emailB = `sec-reminders-b-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Sign up user A
    const signupA = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: emailA, password: 'TestPassword123!', name: 'Reminder Sec A' },
    });
    const hA = signupA.headers['set-cookie'];
    cookieA = Array.isArray(hA) ? hA[0]! : (hA ?? '');

    // Sign up user B
    const signupB = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: emailB, password: 'TestPassword456!', name: 'Reminder Sec B' },
    });
    const hB = signupB.headers['set-cookie'];
    cookieB = Array.isArray(hB) ? hB[0]! : (hB ?? '');

    // Create a case owned by user A
    const caseResp = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: { cookie: cookieA },
      payload: { verticalSlug: 'nacionalidad_residencia', hasChildren: false },
    });
    caseIdA = (caseResp.json() as { id: string }).id;
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, emailA));
    await db.delete(schema.users).where(eq(schema.users.email, emailB));
    await app.close();
  });

  // ── Authentication enforcement ───────────────────────────────────────────────

  skipIfNoDb('POST /api/reminders — returns 401 without a session token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/reminders',
      payload: {
        templateSlug: 'cita_previa',
        scheduledFor: futureDate,
        caseId: caseIdA,
      },
    });
    expect(response.statusCode).toBe(401);
  });

  // ── Ownership / IDOR ─────────────────────────────────────────────────────────

  /**
   * SECURITY GAP DOCUMENTATION:
   * The current implementation (reminders.ts) inserts the reminder with whatever
   * caseId is provided, without checking that it belongs to the authenticated user.
   * This allows user B to create a reminder linked to a case owned by user A,
   * which is an IDOR (Insecure Direct Object Reference) vulnerability.
   *
   * Fix: before inserting, verify that the provided caseId exists in the cases
   * table with userId === request.userId. Return 404 if not found.
   *
   * This test is marked `skipIf(!DB_URL)` and will FAIL until the fix is applied.
   * When it passes, the IDOR has been remediated.
   */
  skipIfNoDb(
    'POST /api/reminders — caseId belonging to another user is rejected with 404',
    async () => {
      // User B attempts to create a reminder using a caseId that belongs to user A
      const response = await app.inject({
        method: 'POST',
        url: '/api/reminders',
        headers: { cookie: cookieB },
        payload: {
          templateSlug: 'cita_previa',
          scheduledFor: futureDate,
          caseId: caseIdA, // case owned by user A — user B should not be able to use it
        },
      });
      // Expected: 404 because the case does not belong to user B
      expect(response.statusCode).toBe(404);
    },
  );

  skipIfNoDb(
    'GET /api/reminders — only returns reminders belonging to the authenticated user',
    async () => {
      // Create a reminder for user A
      await app.inject({
        method: 'POST',
        url: '/api/reminders',
        headers: { cookie: cookieA },
        payload: { templateSlug: 'seguimiento_documentos', scheduledFor: futureDate },
      });

      // Create a reminder for user B
      await app.inject({
        method: 'POST',
        url: '/api/reminders',
        headers: { cookie: cookieB },
        payload: { templateSlug: 'cita_previa', scheduledFor: futureDate },
      });

      // User A lists their reminders — must NOT include user B's reminder
      const responseA = await app.inject({
        method: 'GET',
        url: '/api/reminders',
        headers: { cookie: cookieA },
      });
      expect(responseA.statusCode).toBe(200);
      const remindersA = (responseA.json() as { reminders: Array<{ templateSlug: string }> })
        .reminders;
      // All returned reminders belong to user A (none from user B)
      const hasBReminder = remindersA.some((r) => r.templateSlug === 'cita_previa');
      // User A also has no 'cita_previa' reminder, so this is a good discriminator
      // More important: user B's reminders are NOT present
      for (const reminder of remindersA) {
        // We can't inspect userId from the response easily, but we can verify
        // that user B fetching their own list does not include user A's reminder
        void reminder;
      }

      // User B lists their reminders — must NOT include user A's reminder
      const responseB = await app.inject({
        method: 'GET',
        url: '/api/reminders',
        headers: { cookie: cookieB },
      });
      expect(responseB.statusCode).toBe(200);
      const remindersB = (responseB.json() as { reminders: Array<{ templateSlug: string }> })
        .reminders;

      // User B's list must not contain user A's 'seguimiento_documentos' reminder
      const hasAReminder = remindersB.some((r) => r.templateSlug === 'seguimiento_documentos');
      // Note: if both users happen to have 'seguimiento_documentos' slugs this would be a
      // false positive — in this test user A has it and user B does not.
      expect(hasAReminder).toBe(false);

      // User A's list must not contain user B's 'cita_previa' reminder
      // (user A has no 'cita_previa' reminder in this test scenario)
      expect(hasBReminder).toBe(false);
    },
  );
});
