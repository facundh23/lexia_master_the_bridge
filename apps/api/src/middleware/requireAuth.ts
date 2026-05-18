import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../auth.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value != null) headers.set(key, value);
  }

  const session = await auth.api.getSession({ headers });
  if (!session) {
    return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Autenticación requerida' });
  }

  request.userId = session.user.id;
}
