import { describe, it, expect, vi } from 'vitest';

// Mock auth.ts to avoid DATABASE_URL / BETTER_AUTH_SECRET env requirements
vi.mock('../src/auth.js', () => ({
  auth: {
    handler: vi.fn(),
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

// Mock requireAuth para simular sesión autenticada
vi.mock('../src/middleware/requireAuth.js', () => ({
  requireAuth: vi.fn(async (req: any) => {
    req.userId = 'user-1';
    req.userEmail = 'test@test.com';
  }),
}));

// Mock requireAdmin to avoid auth dependency
vi.mock('../src/middleware/requireAdmin.js', () => ({
  requireAdmin: vi.fn(async (_req: any, reply: any) => {
    reply.status(403).send({ error: 'FORBIDDEN' });
  }),
}));

// Use vi.hoisted so mock variables are available before module initialization
const { mockInsert, mockSelect, mockDelete } = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([{ id: 'pat-uuid-1' }]);
  const mockInsertValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockSelectResult = [
    { id: 'pat-uuid-1', name: 'Mi PAT', lastUsedAt: null, expiresAt: null, createdAt: new Date() },
  ];
  const mockSelectWhere = vi.fn().mockResolvedValue(mockSelectResult);
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockSelect = vi.fn(() => ({ from: mockSelectFrom }));

  const mockDeleteWhere = vi.fn().mockResolvedValue([]);
  const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

  return { mockInsert, mockSelect, mockDelete };
});

vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    delete: mockDelete,
  })),
  schema: {
    personalAccessTokens: {
      id: 'id',
      userId: 'user_id',
      tokenHash: 'token_hash',
      name: 'name',
      lastUsedAt: 'last_used_at',
      expiresAt: 'expires_at',
      createdAt: 'created_at',
    },
    users: { id: 'id', role: 'role', email: 'email' },
    sessions: {},
    accounts: {},
    verifications: {},
    cases: { userId: 'user_id', id: 'id' },
    conversations: {},
    messages: {},
    documents: {},
    reminders: {},
    professionalVerifications: {},
  },
}));

import { buildServer } from '../src/server.js';

describe('PAT routes', () => {
  it('POST /api/auth/pat crea un token de 64 chars y lo devuelve una vez', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/pat',
      payload: { name: 'Mi cliente MCP' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.token).toBeDefined();
    expect(body.token).toHaveLength(64); // 32 bytes hex
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Mi cliente MCP');
  });

  it('POST /api/auth/pat rechaza sin name', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/pat',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/auth/pat lista PATs sin tokenHash', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'GET', url: '/api/auth/pat' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.pats).toBeDefined();
    expect(Array.isArray(body.pats)).toBe(true);
    // Verificar que NO se expone tokenHash
    body.pats.forEach((pat: any) => {
      expect(pat).not.toHaveProperty('tokenHash');
      expect(pat).not.toHaveProperty('token_hash');
    });
  });

  it('DELETE /api/auth/pat/:id devuelve 204', async () => {
    const app = await buildServer();
    const res = await app.inject({ method: 'DELETE', url: '/api/auth/pat/pat-uuid-1' });
    expect(res.statusCode).toBe(204);
  });
});
