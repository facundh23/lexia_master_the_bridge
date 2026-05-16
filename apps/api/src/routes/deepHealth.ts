import type { FastifyPluginAsync } from 'fastify';
import { runPreflight } from '@lexia/core/vertical';

export const deepHealthRoute: FastifyPluginAsync = async (app) => {
  app.get('/api/health/deep', async (_request, reply) => {
    const preflight = runPreflight();

    const status = preflight.ok ? 'ok' : 'degraded';
    const code = preflight.ok ? 200 : 503;

    return reply.status(code).send({
      status,
      service: 'lexia-api',
      preflight,
      checkedAt: new Date(),
    });
  });
};
