import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and, desc } from 'drizzle-orm';
import { runLexiaCore } from '@lexia/core';
import { decryptField, isEncrypted } from '@lexia/core';

const db = createDb(process.env.DATABASE_URL ?? '');

function maybeDecrypt(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key || !isEncrypted(value)) return value;
  try {
    return decryptField(value, key);
  } catch {
    return value;
  }
}

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
        .select({ id: schema.conversations.id, caseId: schema.conversations.caseId })
        .from(schema.conversations)
        .where(
          and(
            eq(schema.conversations.id, conversationId),
            eq(schema.conversations.userId, request.userId),
          ),
        );

      if (!conv) return reply.status(404).send({ error: 'NOT_FOUND' });

      let caseData:
        | {
            countryOrigin?: string;
            arrivalDate?: string;
            residenceStatus?: string;
            hasChildren?: boolean;
          }
        | undefined;

      if (conv.caseId) {
        const [userCase] = await db
          .select({
            countryOrigin: schema.cases.countryOrigin,
            arrivalDate: schema.cases.arrivalDate,
            residenceStatus: schema.cases.residenceStatus,
            hasChildren: schema.cases.hasChildren,
          })
          .from(schema.cases)
          .where(
            and(
              eq(schema.cases.id, conv.caseId),
              eq(schema.cases.userId, request.userId),
            ),
          );

        if (userCase) {
          caseData = {
            countryOrigin: maybeDecrypt(userCase.countryOrigin),
            arrivalDate: userCase.arrivalDate ?? undefined,
            residenceStatus: userCase.residenceStatus ?? undefined,
            hasChildren: userCase.hasChildren,
          };
        }
      }

      const [userMessage] = await db
        .insert(schema.messages)
        .values({ conversationId, role: 'user', content })
        .returning();

      const history = await db
        .select({ role: schema.messages.role, content: schema.messages.content })
        .from(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .orderBy(desc(schema.messages.createdAt))
        .limit(10);

      const conversationHistory = history
        .reverse()
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const lexiaResult = await runLexiaCore({
        content,
        conversationHistory,
        userId: request.userId,
        vertical: 'nacionalidad_residencia',
        caseData,
      });

      const [assistantMessage] = await db
        .insert(schema.messages)
        .values({
          conversationId,
          role: 'assistant',
          content: lexiaResult.response,
          citations: lexiaResult.citations,
          traceId: lexiaResult.traceId ?? null,
        })
        .returning();

      await db
        .update(schema.conversations)
        .set({ updatedAt: new Date() })
        .where(eq(schema.conversations.id, conversationId));

      return reply.send({ userMessage, assistantMessage, route: lexiaResult.route });
    },
  );
};
