import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const meRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/me', { preHandler: [requireAuth] }, async (request, reply) => {
    const user = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        emailVerified: schema.users.emailVerified,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, request.userId))
      .then((rows) => rows[0]);

    if (!user) return reply.status(404).send({ error: 'NOT_FOUND' });
    return user;
  });

  app.get('/api/me/export', { preHandler: [requireAuth] }, async (request) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, request.userId));

    const userCases = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.userId, request.userId));

    const userConversations = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, request.userId));

    return { user, cases: userCases, conversations: userConversations, exportedAt: new Date() };
  });

  app.delete('/api/me/account', { preHandler: [requireAuth] }, async (request, reply) => {
    await db.delete(schema.users).where(eq(schema.users.id, request.userId));
    return reply.status(204).send();
  });
};
