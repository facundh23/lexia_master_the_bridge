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
import { documentsRoute } from './routes/documents.js';
import { deepHealthRoute } from './routes/deepHealth.js';
import { ccseRoute } from './routes/ccse.js';
import { remindersRoute } from './routes/reminders.js';
import { adminRoute } from './routes/admin.js';
import { patRoute } from './routes/pat.js';
import { professionalVerificationRoute } from './routes/professionalVerification.js';
import { mcpRoute } from './routes/mcp.js';
import { auth } from './auth.js';
import multipart from '@fastify/multipart';
import { hibpPasswordCheck } from './middleware/hibpCheck.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAuthRequest(request: any, reply: any) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(
    request.headers as Record<string, string | string[] | undefined>,
  )) {
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

function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'PII_ENCRYPTION_KEY'] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas en producción no seteadas: ${missing.join(', ')}`);
  }
  if (!process.env.ADMIN_EMAILS?.trim()) {
    throw new Error('ADMIN_EMAILS debe estar configurado en producción');
  }
}

export async function buildServer(): Promise<FastifyInstance> {
  validateEnv();

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
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry after ${context.after}.`,
    }),
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB

  await app.register(patRoute);

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
  await app.register(documentsRoute);
  await app.register(deepHealthRoute);
  await app.register(ccseRoute);
  await app.register(remindersRoute);
  await app.register(adminRoute);
  await app.register(professionalVerificationRoute);
  await app.register(mcpRoute);

  app.setErrorHandler((error: { statusCode?: number; name?: string; message?: string }, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Ha ocurrido un error. Intentá nuevamente.',
      });
    }
    return reply.status(statusCode).send({
      statusCode,
      error: error.name ?? 'Error',
      message: error.message ?? 'Error inesperado',
    });
  });

  return app;
}
