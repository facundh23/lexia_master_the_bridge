import type { FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { createDb, schema } from '@lexia/db';
import { eq, and, or, isNull, gt } from 'drizzle-orm';

let _db: ReturnType<typeof createDb> | null = null;
function getDb() {
  if (!_db) _db = createDb(process.env.DATABASE_URL ?? '');
  return _db;
}

export async function requirePat(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Bearer PAT requerido' });
  }

  const token = authHeader.slice(7);
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const db = getDb();
  const now = new Date();

  const rows = await db
    .select({
      patId: schema.personalAccessTokens.id,
      userId: schema.personalAccessTokens.userId,
      userRole: schema.users.role,
      userEmail: schema.users.email,
    })
    .from(schema.personalAccessTokens)
    .innerJoin(schema.users, eq(schema.personalAccessTokens.userId, schema.users.id))
    .where(
      and(
        eq(schema.personalAccessTokens.tokenHash, tokenHash),
        or(
          isNull(schema.personalAccessTokens.expiresAt),
          gt(schema.personalAccessTokens.expiresAt, now),
        ),
      ),
    );

  if (rows.length === 0) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'PAT inválido o expirado' });
  }

  const { patId, userId, userRole, userEmail } = rows[0]!;

  db.update(schema.personalAccessTokens)
    .set({ lastUsedAt: now })
    .where(eq(schema.personalAccessTokens.id, patId))
    .catch(() => undefined);

  request.userId = userId;
  request.userRole = userRole ?? 'user';
  request.userEmail = userEmail;
}
