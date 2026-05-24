import { describe, it, expect, vi } from 'vitest';

vi.mock('@lexia/db', () => {
  const mockSelect = vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  }));
  const mockUpdate = vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    catch: vi.fn(),
  }));
  return {
    createDb: vi.fn(() => ({ select: mockSelect, update: mockUpdate })),
    schema: {
      personalAccessTokens: {
        id: 'id',
        userId: 'user_id',
        tokenHash: 'token_hash',
        expiresAt: 'expires_at',
        lastUsedAt: 'last_used_at',
      },
      users: { id: 'id', role: 'role', email: 'email' },
    },
  };
});

import { requirePat } from '../src/middleware/requirePat.js';

function makeReq(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
    userId: '',
    userEmail: undefined as string | undefined,
    userRole: undefined as string | undefined,
  } as any;
}

function makeReply() {
  const r: any = {};
  r.status = (code: number) => {
    r._status = code;
    return r;
  };
  r.send = (body: any) => {
    r._body = body;
    return r;
  };
  return r;
}

describe('requirePat', () => {
  it('rechaza sin header Authorization', async () => {
    const reply = makeReply();
    await requirePat(makeReq(), reply);
    expect(reply._status).toBe(401);
    expect(reply._body.error).toBe('UNAUTHORIZED');
  });

  it('rechaza con header que no es Bearer', async () => {
    const reply = makeReply();
    await requirePat(makeReq('Basic dXNlcjpwYXNz'), reply);
    expect(reply._status).toBe(401);
  });

  it('rechaza con token que no existe en DB (mock devuelve [])', async () => {
    const reply = makeReply();
    await requirePat(makeReq('Bearer faketoken123'), reply);
    expect(reply._status).toBe(401);
  });
});
