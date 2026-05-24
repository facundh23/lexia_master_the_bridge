import type { FastifyPluginAsync } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { createDb, schema } from '@lexia/db';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '../middleware/requireAuth.js';

const db = createDb(process.env.DATABASE_URL ?? '');

export const patRoute: FastifyPluginAsync = async (app) => {
  // POST /api/auth/pat — genera PAT, devuelve token plaintext UNA SOLA VEZ
  app.post('/api/auth/pat', { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { name?: string } | null;
    const name = body?.name?.trim();
    if (!name) {
      return reply.status(400).send({ error: 'BAD_REQUEST', message: 'name es requerido' });
    }

    // 32 bytes de CSPRNG = 256 bits de entropía
    const token = randomBytes(32).toString('hex');
    // SHA-256: suficiente para tokens de alta entropía, más rápido que bcrypt
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [row] = await db
      .insert(schema.personalAccessTokens)
      .values({ userId: request.userId, tokenHash, name })
      .returning({ id: schema.personalAccessTokens.id });

    // Token visible UNA SOLA VEZ. Después solo el id.
    return reply.status(201).send({ id: row!.id, token, name });
  });

  // GET /api/auth/pat — lista PATs del usuario SIN tokenHash
  app.get('/api/auth/pat', { preHandler: [requireAuth] }, async (request) => {
    const pats = await db
      .select({
        id: schema.personalAccessTokens.id,
        name: schema.personalAccessTokens.name,
        lastUsedAt: schema.personalAccessTokens.lastUsedAt,
        expiresAt: schema.personalAccessTokens.expiresAt,
        createdAt: schema.personalAccessTokens.createdAt,
      })
      .from(schema.personalAccessTokens)
      .where(eq(schema.personalAccessTokens.userId, request.userId));

    return { pats };
  });

  // DELETE /api/auth/pat/:id — revoca PAT (solo el propietario)
  app.delete('/api/auth/pat/:id', { preHandler: [requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    await db
      .delete(schema.personalAccessTokens)
      .where(
        and(
          eq(schema.personalAccessTokens.id, id),
          eq(schema.personalAccessTokens.userId, request.userId),
        ),
      );

    return reply.status(204).send();
  });
};
