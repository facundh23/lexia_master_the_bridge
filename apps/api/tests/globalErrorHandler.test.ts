/**
 * globalErrorHandler.test.ts
 *
 * Verifies that the Fastify global error handler:
 *   1. Swallows internal server errors (5xx) — returns generic message, no stack trace,
 *      no database connection strings, no filesystem paths.
 *   2. Passes through 4xx errors with their original message.
 *   3. Response body for 500 errors never contains sensitive information.
 *
 * Strategy: register lightweight test-only routes on the server that deliberately
 * throw errors, then assert on the shaped response.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

const DB_URL = process.env.DATABASE_URL ?? '';
const skipIfNoDb = it.skipIf(!DB_URL);

describe('Global error handler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();

    // Register test-only routes that intentionally throw errors
    app.get('/test/throw-500', async () => {
      const err = new Error(
        `Something went wrong: postgresql://${process.env.DATABASE_URL ?? 'user:pass@localhost/db'}`,
      );
      // No statusCode → error handler must treat it as 500
      throw err;
    });

    app.get('/test/throw-400', async () => {
      const err = Object.assign(new Error('Parámetro inválido'), { statusCode: 400 });
      throw err;
    });

    app.get('/test/throw-422', async () => {
      const err = Object.assign(new Error('Entidad no procesable'), { statusCode: 422 });
      throw err;
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 500 behavior ─────────────────────────────────────────────────────────────

  skipIfNoDb('unhandled Error without statusCode → returns 500 with generic message', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-500' });
    expect(response.statusCode).toBe(500);

    const body = response.json() as {
      statusCode: number;
      error: string;
      message: string;
    };
    expect(body.statusCode).toBe(500);
    expect(body.message).toBe('Ha ocurrido un error. Intentá nuevamente.');
  });

  skipIfNoDb('500 response body does not contain stack trace', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-500' });
    const raw = response.body;

    expect(raw).not.toContain('stack');
    expect(raw).not.toContain('at Object.');
    expect(raw).not.toContain('    at '); // stack frame indentation pattern
  });

  skipIfNoDb('500 response body does not leak database connection strings', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-500' });
    const raw = response.body;

    // Must not contain postgresql:// or postgres:// URLs
    expect(raw).not.toMatch(/postgresql?:\/\//);
  });

  skipIfNoDb('500 response body does not leak filesystem paths', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-500' });
    const raw = response.body;

    // Must not contain absolute Windows or Unix file paths from the server process
    expect(raw).not.toMatch(/[A-Za-z]:\\Users\\/); // Windows path
    expect(raw).not.toMatch(/\/home\/\w/); // Linux home path
    expect(raw).not.toMatch(/\/app\/src\//); // Docker/container path
  });

  // ── 4xx pass-through ─────────────────────────────────────────────────────────

  skipIfNoDb('error with statusCode 400 → returns 400 with the original message', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-400' });
    expect(response.statusCode).toBe(400);

    const body = response.json() as { statusCode: number; message: string };
    expect(body.statusCode).toBe(400);
    expect(body.message).toBe('Parámetro inválido');
  });

  skipIfNoDb('error with statusCode 422 → returns 422 with the original message', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-422' });
    expect(response.statusCode).toBe(422);

    const body = response.json() as { statusCode: number; message: string };
    expect(body.statusCode).toBe(422);
    expect(body.message).toBe('Entidad no procesable');
  });

  skipIfNoDb('4xx response body does not expose stack trace', async () => {
    const response = await app.inject({ method: 'GET', url: '/test/throw-400' });
    const raw = response.body;

    expect(raw).not.toContain('at Object.');
    expect(raw).not.toContain('    at ');
  });
});
