import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';
import { encryptField, decryptField, isEncrypted } from '@lexia/core';

const db = createDb(process.env.DATABASE_URL ?? '');

const PII_FIELDS = ['countryOrigin', 'notes'] as const;
type PiiField = (typeof PII_FIELDS)[number];

function getKey(): string | undefined {
  return process.env.PII_ENCRYPTION_KEY || undefined;
}

function encryptPII(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const key = getKey();
  if (!key) return value;
  return encryptField(value, key);
}

function decryptPII(value: string | null | undefined): string | null {
  if (!value) return value ?? null;
  const key = getKey();
  if (!key || !isEncrypted(value)) return value;
  try {
    return decryptField(value, key);
  } catch {
    return value;
  }
}

function decryptCase<T extends Record<string, unknown>>(row: T): T {
  const result = { ...row };
  for (const field of PII_FIELDS) {
    if (field in result) {
      (result as Record<string, unknown>)[field] = decryptPII(result[field] as string | null);
    }
  }
  return result;
}

export const casesRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/cases', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as {
      verticalSlug?: string;
      countryOrigin?: string;
      arrivalDate?: string;
      residenceStatus?: string;
      hasChildren?: boolean;
      notes?: string;
    };

    const [newCase] = await db
      .insert(schema.cases)
      .values({
        userId: request.userId,
        verticalSlug: body.verticalSlug ?? 'nacionalidad_residencia',
        countryOrigin: encryptPII(body.countryOrigin),
        arrivalDate: body.arrivalDate ?? null,
        residenceStatus: body.residenceStatus ?? null,
        hasChildren: body.hasChildren ?? false,
        notes: encryptPII(body.notes),
      })
      .returning();

    return reply.status(201).send(decryptCase(newCase!));
  });

  app.get('/api/cases', { preHandler: [requireAuth] }, async (request) => {
    const rows = await db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.userId, request.userId), eq(schema.cases.status, 'active')));
    return rows.map(decryptCase);
  });

  app.get('/api/cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [found] = await db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.id, id), eq(schema.cases.userId, request.userId)));

    if (!found) return reply.status(404).send({ error: 'NOT_FOUND' });
    return decryptCase(found);
  });

  app.patch('/api/cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const VALID_STATUSES = ['active', 'closed', 'archived'] as const;
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if ('countryOrigin' in body) patch.countryOrigin = encryptPII(body.countryOrigin as string | undefined);
    if ('arrivalDate' in body) patch.arrivalDate = body.arrivalDate ?? null;
    if ('residenceStatus' in body) patch.residenceStatus = body.residenceStatus ?? null;
    if ('hasChildren' in body) patch.hasChildren = Boolean(body.hasChildren);
    if ('notes' in body) patch.notes = encryptPII(body.notes as string | undefined);
    if ('status' in body) {
      if (!VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'status inválido' });
      }
      patch.status = body.status;
    }

    const [updated] = await db
      .update(schema.cases)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(patch as any)
      .where(and(eq(schema.cases.id, id), eq(schema.cases.userId, request.userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'NOT_FOUND' });
    return decryptCase(updated);
  });
};
