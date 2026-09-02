import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/auth.js', () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue(null) },
    handler: vi.fn(),
  },
}));

vi.mock('../src/mailer.js', () => ({
  mailer: { sendMail: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../src/middleware/requireAuth.js', () => ({
  requireAuth: vi.fn(async (req: any) => {
    req.userId = 'user-gestor';
    req.userEmail = 'gestor@bufete.es';
  }),
}));
vi.mock('../src/middleware/requireAdmin.js', () => ({
  requireAdmin: vi.fn(async (req: any) => {
    req.userId = 'admin-1';
    req.userEmail = 'admin@lexia.es';
  }),
}));

vi.mock('@lexia/db', () => {
  const mockInsertValues = vi.fn(() => ({
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
  }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));

  const mockVerificationsList = [
    {
      id: 'ver-1',
      userId: 'user-gestor',
      collegiateNumber: '12345',
      collegiateBody: 'ICAM',
      status: 'pending',
      createdAt: new Date(),
    },
  ];
  const mockSelectFromAll = vi.fn().mockResolvedValue(mockVerificationsList);
  const mockSelect = vi.fn(() => ({ from: mockSelectFromAll }));

  const mockUpdateReturning = vi.fn().mockResolvedValue([{ userId: 'user-gestor' }]);
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

  return {
    createDb: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    })),
    schema: {
      professionalVerifications: {
        id: 'id',
        userId: 'user_id',
        collegiateNumber: 'collegiate_number',
        collegiateBody: 'collegiate_body',
        status: 'status',
        reviewedAt: 'reviewed_at',
        createdAt: 'created_at',
      },
      users: { id: 'id', role: 'role' },
    },
  };
});

import { buildServer } from '../src/server.js';

describe('Professional verification routes', () => {
  it('POST /api/me/professional-verification crea solicitud pending', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/professional-verification',
      payload: { collegiateNumber: '12345', collegiateBody: 'ICAM' },
    });
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('pending');
  });

  it('POST /api/me/professional-verification rechaza sin datos', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/professional-verification',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/admin/professional-verifications lista verificaciones', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/professional-verifications',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.verifications).toBeDefined();
  });

  it('PATCH /api/admin/professional-verifications/:id aprueba y actualiza role', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/admin/professional-verifications/ver-1',
      payload: { status: 'approved' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('approved');
  });
});
