import './types.js';
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { healthRoute } from './routes/health.js';
import { meRoute } from './routes/me.js';
import { casesRoute } from './routes/cases.js';
import { conversationsRoute } from './routes/conversations.js';
import { messagesRoute } from './routes/messages.js';
import { auth } from './auth.js';
import { hibpPasswordCheck } from './middleware/hibpCheck.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAuthRequest(request: any, reply: any) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers as Record<string, string | string[] | undefined>)) {
    if (Array.isArray(value)) headers.set(key, value.join(', '));
    else if (value !== undefined) headers.set(key, value);
  }
  const init: RequestInit = { method: request.method, headers };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = JSON.stringify((request as { body?: unknown }).body ?? {});
  }
  const webRequest = new Request(url, init);
  const response = await auth.handler(webRequest);
  reply.status(response.status);
  response.headers.forEach((value: string, key: string) => reply.header(key, value));
  return reply.send(await response.text());
}

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'test' ? 'silent' : 'info' },
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:4000',
    ],
    credentials: true,
  });
  await app.register(sensible);
  await app.register(rateLimit, { global: false });

  // Auth routes con rate limits específicos y HIBP check en sign-up
  app.post('/api/auth/sign-up/email', {
    config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    preHandler: [hibpPasswordCheck],
    handler: handleAuthRequest,
  });

  app.post('/api/auth/sign-in/email', {
    config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    handler: handleAuthRequest,
  });

  // Fallback para el resto de rutas auth
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: handleAuthRequest,
  });

  await app.register(healthRoute);
  await app.register(meRoute);
  await app.register(casesRoute);
  await app.register(conversationsRoute);
  await app.register(messagesRoute);

  return app;
}
