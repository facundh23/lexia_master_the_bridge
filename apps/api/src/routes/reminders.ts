import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, desc } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const remindersRoute: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/reminders',
    { preHandler: [requireAuth] },
    async (request) => {
      const reminders = await db
        .select()
        .from(schema.reminders)
        .where(eq(schema.reminders.userId, request.userId))
        .orderBy(desc(schema.reminders.scheduledFor));
      return { reminders };
    },
  );

  app.post(
    '/api/reminders',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = request.body as { templateSlug?: string; scheduledFor?: string; caseId?: string } | null;

      if (!body?.templateSlug || !body?.scheduledFor) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'templateSlug y scheduledFor son requeridos' });
      }

      const scheduledDate = new Date(body.scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'scheduledFor debe ser una fecha ISO válida' });
      }

      const [reminder] = await db
        .insert(schema.reminders)
        .values({
          userId: request.userId,
          caseId: body.caseId ?? null,
          templateSlug: body.templateSlug,
          scheduledFor: scheduledDate,
        })
        .returning();

      return reply.status(201).send(reminder);
    },
  );
};
