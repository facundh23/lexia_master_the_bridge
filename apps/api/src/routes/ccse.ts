import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { createDb, schema } from '@lexia/db';
import { eq, desc } from 'drizzle-orm';
import { generateCcseQuiz, evaluateCcseAnswers } from '@lexia/core';

const db = createDb(process.env.DATABASE_URL ?? '');

export const ccseRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/ccse/quiz', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { size?: number } | null;
    const quizSize = Math.min(Math.max(body?.size ?? 25, 5), 50);
    const result = await generateCcseQuiz(request.userId, quizSize);
    if (!result.attemptId) {
      return reply
        .status(503)
        .send({ error: 'SERVICE_UNAVAILABLE', message: 'No se pudo generar el simulacro' });
    }
    return result;
  });

  app.post(
    '/api/ccse/attempts/:attemptId/submit',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { attemptId } = request.params as { attemptId: string };
      const body = request.body as {
        answers?: Array<{ questionId: string; selectedOption: number }>;
      } | null;
      const answers = body?.answers;

      if (!Array.isArray(answers) || answers.length === 0) {
        return reply.status(400).send({ error: 'BAD_REQUEST', message: 'answers es requerido' });
      }

      const [attempt] = await db
        .select({ userId: schema.ccseAttempts.userId })
        .from(schema.ccseAttempts)
        .where(eq(schema.ccseAttempts.id, attemptId));

      if (!attempt || attempt.userId !== request.userId) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }

      return evaluateCcseAnswers(attemptId, answers);
    },
  );

  app.get('/api/ccse/history', { preHandler: [requireAuth] }, async (request) => {
    const attempts = await db
      .select({
        id: schema.ccseAttempts.id,
        quizSize: schema.ccseAttempts.quizSize,
        score: schema.ccseAttempts.score,
        maxScore: schema.ccseAttempts.maxScore,
        durationSeconds: schema.ccseAttempts.durationSeconds,
        completedAt: schema.ccseAttempts.completedAt,
        createdAt: schema.ccseAttempts.createdAt,
      })
      .from(schema.ccseAttempts)
      .where(eq(schema.ccseAttempts.userId, request.userId))
      .orderBy(desc(schema.ccseAttempts.createdAt))
      .limit(20);

    return { attempts };
  });
};
