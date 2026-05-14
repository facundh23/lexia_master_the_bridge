import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

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
        countryOrigin: body.countryOrigin ?? null,
        arrivalDate: body.arrivalDate ?? null,
        residenceStatus: body.residenceStatus ?? null,
        hasChildren: body.hasChildren ?? false,
        notes: body.notes ?? null,
      })
      .returning();

    return reply.status(201).send(newCase);
  });

  app.get('/api/cases', { preHandler: [requireAuth] }, async (request) => {
    return db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.userId, request.userId), eq(schema.cases.status, 'active')));
  });

  app.get('/api/cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [found] = await db
      .select()
      .from(schema.cases)
      .where(and(eq(schema.cases.id, id), eq(schema.cases.userId, request.userId)));

    if (!found) return reply.status(404).send({ error: 'NOT_FOUND' });
    return found;
  });

  app.patch('/api/cases/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      countryOrigin: string;
      arrivalDate: string;
      residenceStatus: string;
      hasChildren: boolean;
      notes: string;
      status: string;
    }>;

    const [updated] = await db
      .update(schema.cases)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(schema.cases.id, id), eq(schema.cases.userId, request.userId)))
      .returning();

    if (!updated) return reply.status(404).send({ error: 'NOT_FOUND' });
    return updated;
  });
};
