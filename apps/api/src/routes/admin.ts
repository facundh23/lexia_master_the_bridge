import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const adminRoute: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/admin/ccse/questions',
    { preHandler: [requireAdmin] },
    async (request) => {
      const query = request.query as { verified?: string };

      if (query.verified === 'true') {
        const questions = await db
          .select()
          .from(schema.ccseQuestions)
          .where(eq(schema.ccseQuestions.verifiedByHuman, true));
        return { questions, total: questions.length };
      }

      if (query.verified === 'false') {
        const questions = await db
          .select()
          .from(schema.ccseQuestions)
          .where(eq(schema.ccseQuestions.verifiedByHuman, false));
        return { questions, total: questions.length };
      }

      const questions = await db.select().from(schema.ccseQuestions);
      return { questions, total: questions.length };
    },
  );

  app.patch(
    '/api/admin/ccse/questions/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { verifiedByHuman?: boolean } | null;

      if (typeof body?.verifiedByHuman !== 'boolean') {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'verifiedByHuman boolean requerido' });
      }

      const updated = await db
        .update(schema.ccseQuestions)
        .set({ verifiedByHuman: body.verifiedByHuman })
        .where(eq(schema.ccseQuestions.id, id))
        .returning({ id: schema.ccseQuestions.id });

      if (!updated.length) return reply.status(404).send({ error: 'NOT_FOUND' });
      return { id, verifiedByHuman: body.verifiedByHuman };
    },
  );
};
