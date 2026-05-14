import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

export const messagesRoute: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/conversations/:id/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id: conversationId } = request.params as { id: string };
      const body = request.body as { content?: string };
      const content = body.content?.trim();

      if (!content) return reply.status(400).send({ error: 'CONTENT_REQUIRED' });

      const [conv] = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.id, conversationId),
            eq(schema.conversations.userId, request.userId),
          ),
        );

      if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });

      const [userMessage] = await db
        .insert(schema.messages)
        .values({ conversationId, role: 'user', content })
        .returning();

      // Echo response (F2 replaces this with real LLM call)
      const echoContent = `Lexia [eco]: ${content}`;
      const [assistantMessage] = await db
        .insert(schema.messages)
        .values({ conversationId, role: 'assistant', content: echoContent })
        .returning();

      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));

      return reply.send({ userMessage, assistantMessage });
    },
  );
};
