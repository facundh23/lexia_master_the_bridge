import { PassThrough } from 'node:stream';
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, and, desc } from 'drizzle-orm';
import { runLexiaCore, runLexiaCoreStream } from '@lexia/core';
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
          .where(and(eq(schema.cases.id, conv.caseId), eq(schema.cases.userId, request.userId)));

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

      if (lexiaResult.blocked) {
        await db.insert(schema.auditLog).values({
          actorType: 'user',
          actorId: request.userId,
          surface: 'web',
          action: 'input_blocked',
          targetType: 'conversation',
          targetId: conversationId,
          details: {
            reason: lexiaResult.blockReason,
            query: '[REDACTED]',
          },
          traceId: lexiaResult.traceId ?? null,
        });
      }

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

  app.post(
    '/api/conversations/:id/messages/stream',
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
          .where(and(eq(schema.cases.id, conv.caseId), eq(schema.cases.userId, request.userId)));

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

      // Setup SSE — X-Accel-Buffering: no prevents nginx/Next.js from buffering
      const sseStream = new PassThrough();
      reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache')
        .header('Connection', 'keep-alive')
        .header('X-Accel-Buffering', 'no')
        .send(sseStream);

      const sendEvent = (data: object) => {
        sseStream.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const streamedTokens: string[] = [];

        const lexiaResult = await runLexiaCoreStream(
          {
            content,
            conversationHistory,
            userId: request.userId,
            vertical: 'nacionalidad_residencia',
            caseData,
          },
          (token) => {
            streamedTokens.push(token);
            sendEvent({ type: 'token', content: token });
          },
        );

        // If output guardrails modified the streamed text, tell the client to replace it
        const streamedText = streamedTokens.join('');
        if (lexiaResult.response !== streamedText) {
          sendEvent({ type: 'replace', content: lexiaResult.response });
        }

        if (lexiaResult.blocked) {
          await db.insert(schema.auditLog).values({
            actorType: 'user',
            actorId: request.userId,
            surface: 'web',
            action: 'input_blocked',
            targetType: 'conversation',
            targetId: conversationId,
            details: { reason: lexiaResult.blockReason, query: '[REDACTED]' },
            traceId: lexiaResult.traceId ?? null,
          });
        }

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

        if (userMessage && assistantMessage) {
          sendEvent({
            type: 'done',
            userMessageId: userMessage.id,
            assistantMessageId: assistantMessage.id,
            citations: lexiaResult.citations,
            route: lexiaResult.route,
          });
        }
      } catch (err) {
        sendEvent({ type: 'error', message: 'Error procesando tu consulta. Intentá de nuevo.' });
      } finally {
        sseStream.end();
      }
    },
  );
};
