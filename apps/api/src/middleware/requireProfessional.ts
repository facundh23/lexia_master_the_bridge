import type { FastifyReply, FastifyRequest } from 'fastify';

export async function requireProfessional(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (request.userRole !== 'professional') {
    return reply
      .status(403)
      .send({ error: 'FORBIDDEN', message: 'Acceso restringido a profesionales verificados' });
  }
}
