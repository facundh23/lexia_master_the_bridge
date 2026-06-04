import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const DB_URL = process.env.DATABASE_URL ?? '';
const skipIfNoDb = it.skipIf(!DB_URL);

describe('Cases — security: mass assignment, ownership, and auth enforcement', () => {
  let app: FastifyInstance;
  let cookieA: string;
  let cookieB: string;
  let caseIdA: string;
  const emailA = `sec-cases-a-${Date.now()}@lexia.local`;
  const emailB = `sec-cases-b-${Date.now()}@lexia.local`;
  const db = createDb(DB_URL);

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    // Sign up user A
    const signupA = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: emailA, password: 'TestPassword123!', name: 'Security Test A' },
    });
    const cookieHeaderA = signupA.headers['set-cookie'];
    cookieA = Array.isArray(cookieHeaderA) ? cookieHeaderA[0]! : (cookieHeaderA ?? '');

    // Sign up user B
    const signupB = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      payload: { email: emailB, password: 'TestPassword456!', name: 'Security Test B' },
    });
    const cookieHeaderB = signupB.headers['set-cookie'];
    cookieB = Array.isArray(cookieHeaderB) ? cookieHeaderB[0]! : (cookieHeaderB ?? '');

    // Create a case owned by user A
    const created = await app.inject({
      method: 'POST',
      url: '/api/cases',
      headers: { cookie: cookieA },
      payload: {
        verticalSlug: 'nacionalidad_residencia',
        countryOrigin: 'Argentina',
        hasChildren: false,
      },
    });
    caseIdA = (created.json() as { id: string }).id;
  });

  afterAll(async () => {
    await db.delete(schema.users).where(eq(schema.users.email, emailA));
    await db.delete(schema.users).where(eq(schema.users.email, emailB));
    await app.close();
  });

  // ── Mass assignment ─────────────────────────────────────────────────────────

  skipIfNoDb('PATCH /api/cases/:id — userId is not writable via body', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/cases/${caseIdA}`,
      headers: { cookie: cookieA },
      payload: { userId: 'user-B-attacker-uuid' },
    });
    // Must succeed (200 or the row was found and returned) but userId must NOT change
    expect(response.statusCode).toBe(200);
    const body = response.json() as { userId: string };
    expect(body.userId).not.toBe('user-B-attacker-uuid');
  });

  skipIfNoDb('PATCH /api/cases/:id — invalid status value returns 400', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/cases/${caseIdA}`,
      headers: { cookie: cookieA },
      payload: { status: 'invalid_status' },
    });
    expect(response.statusCode).toBe(400);
  });

  skipIfNoDb('PATCH /api/cases/:id — valid status "closed" returns 200', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/cases/${caseIdA}`,
      headers: { cookie: cookieA },
      payload: { status: 'closed' },
    });
    expect(response.statusCode).toBe(200);
    // Reset status back to active so subsequent tests work
    await app.inject({
      method: 'PATCH',
      url: `/api/cases/${caseIdA}`,
      headers: { cookie: cookieA },
      payload: { status: 'active' },
    });
  });

  skipIfNoDb(
    'PATCH /api/cases/:id — verticalSlug is NOT in whitelist and is ignored; countryOrigin IS updated',
    async () => {
      // First, get the original verticalSlug value
      const before = await app.inject({
        method: 'GET',
        url: `/api/cases/${caseIdA}`,
        headers: { cookie: cookieA },
      });
      const originalVerticalSlug = (before.json() as { verticalSlug: string }).verticalSlug;

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/cases/${caseIdA}`,
        headers: { cookie: cookieA },
        payload: { verticalSlug: 'otro_vertical', countryOrigin: 'Colombia' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json() as { verticalSlug: string; countryOrigin: string };

      // verticalSlug should be unchanged (not in the patch whitelist)
      expect(body.verticalSlug).toBe(originalVerticalSlug);

      // countryOrigin should be updated
      expect(body.countryOrigin).toBe('Colombia');
    },
  );

  // ── Ownership / IDOR ─────────────────────────────────────────────────────────

  skipIfNoDb(
    'GET /api/cases/:id — user B cannot read a case belonging to user A (returns 404)',
    async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/cases/${caseIdA}`,
        headers: { cookie: cookieB },
      });
      expect(response.statusCode).toBe(404);
    },
  );

  skipIfNoDb(
    'PATCH /api/cases/:id — user B cannot patch a case belonging to user A (returns 404)',
    async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/cases/${caseIdA}`,
        headers: { cookie: cookieB },
        payload: { countryOrigin: 'Hacked' },
      });
      expect(response.statusCode).toBe(404);
    },
  );

  // ── Authentication enforcement ───────────────────────────────────────────────

  skipIfNoDb('GET /api/cases — returns 401 without a session token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/cases' });
    expect(response.statusCode).toBe(401);
  });

  skipIfNoDb('POST /api/cases — returns 401 without a session token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/cases',
      payload: { verticalSlug: 'nacionalidad_residencia' },
    });
    expect(response.statusCode).toBe(401);
  });

  skipIfNoDb('PATCH /api/cases/:id — returns 401 without a session token', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/cases/${caseIdA}`,
      payload: { countryOrigin: 'Uruguay' },
    });
    expect(response.statusCode).toBe(401);
  });
});
