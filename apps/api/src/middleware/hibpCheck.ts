import type { FastifyReply, FastifyRequest } from 'fastify';
import { pwnedPassword } from 'hibp';

export async function hibpPasswordCheck(
  request: FastifyRequest<{ Body: { password?: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const password = (request.body as { password?: string } | undefined)?.password;
  if (!password) return;

  // Skip HIBP in test environment to avoid network calls
  if (process.env.NODE_ENV === 'test') return;

  const count = await pwnedPassword(password);
  if (count > 0) {
    return reply.status(400).send({
      error: 'HIBP_PWNED',
      message:
        'Esta contraseña fue expuesta en filtraciones de datos públicas. Elegí una diferente.',
    });
  }
}
