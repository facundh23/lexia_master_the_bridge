import type { FastifyPluginAsync } from 'fastify';
import { createDb, schema } from '@lexia/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const db = createDb(process.env.DATABASE_URL ?? '');

export const professionalVerificationRoute: FastifyPluginAsync = async (app) => {
  // Gestor solicita verificación de colegiación
  app.post(
    '/api/me/professional-verification',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const body = request.body as {
        collegiateNumber?: string;
        collegiateBody?: string;
      } | null;

      const { collegiateNumber, collegiateBody } = body ?? {};
      if (!collegiateNumber?.trim() || !collegiateBody?.trim()) {
        return reply
          .status(400)
          .send({ error: 'BAD_REQUEST', message: 'collegiateNumber y collegiateBody son requeridos' });
      }

      // Upsert: si ya tiene una verificación, actualizarla a pending
      await db
        .insert(schema.professionalVerifications)
        .values({
          userId: request.userId,
          collegiateNumber: collegiateNumber.trim(),
          collegiateBody: collegiateBody.trim(),
          status: 'pending',
        })
        .onConflictDoUpdate({
          target: schema.professionalVerifications.userId,
          set: {
            collegiateNumber: collegiateNumber.trim(),
            collegiateBody: collegiateBody.trim(),
            status: 'pending',
            reviewedAt: null,
          },
        });

      return reply.status(202).send({ status: 'pending' });
    },
  );

  // Admin lista verificaciones
  app.get(
    '/api/admin/professional-verifications',
    { preHandler: [requireAdmin] },
    async () => {
      const verifications = await db
        .select({
          id: schema.professionalVerifications.id,
          userId: schema.professionalVerifications.userId,
          collegiateNumber: schema.professionalVerifications.collegiateNumber,
          collegiateBody: schema.professionalVerifications.collegiateBody,
          status: schema.professionalVerifications.status,
          createdAt: schema.professionalVerifications.createdAt,
        })
        .from(schema.professionalVerifications);

      return { verifications };
    },
  );

  // Admin aprueba o rechaza — actualiza status y role del usuario
  app.patch(
    '/api/admin/professional-verifications/:id',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status?: 'approved' | 'rejected' } | null;

      if (body?.status !== 'approved' && body?.status !== 'rejected') {
        return reply
          .status(400)
          .send({ error: 'BAD_REQUEST', message: 'status debe ser approved o rejected' });
      }

      const [verification] = await db
        .update(schema.professionalVerifications)
        .set({ status: body.status, reviewedAt: new Date() })
        .where(eq(schema.professionalVerifications.id, id))
        .returning({ userId: schema.professionalVerifications.userId });

      if (!verification) {
        return reply.status(404).send({ error: 'NOT_FOUND' });
      }

      // Actualizar role en users — revocación/aprobación instantánea (sin JWT que expire)
      const newRole = body.status === 'approved' ? 'professional' : 'user';
      await db
        .update(schema.users)
        .set({ role: newRole })
        .where(eq(schema.users.id, verification.userId));

      return { status: body.status };
    },
  );
};
