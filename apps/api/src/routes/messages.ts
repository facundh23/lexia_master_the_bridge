import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';
import { runLexiaCore } from '@lexia/core';

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

      // Obtener historial para contexto (últimas 10 exchanges)
      const history = await db
        .select({ role: schema.messages.role, content: schema.messages.content })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(schema.messages.createdAt);

      const conversationHistory = history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(-10)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      // Llamar LexiaCore (guardrails + NormativaAgent)
      const lexiaResult = await runLexiaCore({
        content,
        conversationHistory,
        userId: request.userId,
        vertical: 'nacionalidad_residencia',
      });

      const [assistantMessage] = await db
        .insert(schema.messages)
        .values({
          conversationId,
          role: 'assistant',
          content: lexiaResult.response,
          citations: lexiaResult.citations,
        })
        .returning();

      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));

      return reply.send({ userMessage, assistantMessage });
    },
  );
};
