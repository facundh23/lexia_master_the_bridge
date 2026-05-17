import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';

const db = createDb(process.env.DATABASE_URL ?? '');

const AI_DISCLOSURE =
  'Hola, soy Lexia, un asistente de inteligencia artificial especializado en información sobre la nacionalidad española por residencia. Puedo ayudarte a entender el procedimiento, requisitos, plazos y documentación necesaria.\n\n⚠️ Soy un sistema de IA. La información que proporciono es orientativa y no sustituye el asesoramiento jurídico de un abogado o gestor habilitado.\n\n¿En qué puedo ayudarte hoy?';

export const conversationsRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/conversations', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { title?: string; caseId?: string };
    const [conv] = await db
      .insert(schema.conversations)
      .values({
        userId: request.userId,
        title: body.title ?? null,
        caseId: body.caseId ?? null,
        surface: 'web',
      })
      .returning();

    if (!conv) return reply.status(500).send({ error: 'INTERNAL_ERROR' });

    // AI Act Art. 50 — disclosure obligatorio al inicio de cada conversación
    await db.insert(schema.messages).values({
      conversationId: conv.id,
      role: 'assistant',
      content: AI_DISCLOSURE,
      citations: [],
    });

    return reply.status(201).send(conv);
  });

  app.get('/api/conversations', { preHandler: [requireAuth] }, async (request) => {
    return db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.userId, request.userId))
      .orderBy(schema.conversations.updatedAt);
  });

  app.get('/api/conversations/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, id), eq(schema.conversations.userId, request.userId)));

    if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });
    return conv;
  });

  app.get(
    '/api/conversations/:id/messages',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const [conv] = await db
        .select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(
          and(eq(schema.conversations.id, id), eq(schema.conversations.userId, request.userId)),
        );

      if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });

      return db
        .select()
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, id))
        .orderBy(schema.messages.createdAt);
    },
  );
};
