import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/middleware/requirePat.js', () => ({
  requirePat: vi.fn(async (req: any) => {
    req.userId = 'pro-user';
    req.userRole = 'professional';
    req.userEmail = 'gestor@bufete.es';
  }),
}));
vi.mock('../src/middleware/requireProfessional.js', () => ({
  requireProfessional: vi.fn(async () => undefined),
}));
vi.mock('@lexia/core', () => ({
  runNormativaAgent: vi.fn().mockResolvedValue({
    response: 'Art. 22 CC: 2 años para iberoamericanos.',
    citations: ['Art. 22 CC'],
  }),
  computeEligibility: vi.fn().mockReturnValue({
    yearsRequired: 2,
    yearsElapsed: 3,
    isEligible: true,
    specialCase: 'iberoamerican',
    legalBasis: 'Art. 22.1 CC',
    notes: [],
  }),
  nacionalidadResidencia: {
    slug: 'nacionalidad_residencia',
    name: 'Nacionalidad por Residencia',
    intake: { fields: ['countryOrigin', 'arrivalDate'] },
    corpus: { sources: ['BOE'] },
    reminders: [],
  },
}));
vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue([]) })),
  })),
  schema: { auditLog: 'auditLog' },
}));
vi.mock('../src/auth.js', () => ({ auth: { handler: vi.fn(), api: { getSession: vi.fn() } } }));
vi.mock('../src/mailer.js', () => ({ mailer: { sendMail: vi.fn() } }));

import { buildServer } from '../src/server.js';

describe('MCP routes', () => {
  it('POST /api/mcp/search devuelve response + citations + surface=mcp', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp/search',
      payload: { query: '¿Cuántos años necesito?', vertical: 'nacionalidad_residencia' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.response).toBeDefined();
    expect(body.citations).toBeDefined();
    expect(body.surface).toBe('mcp');
  });

  it('POST /api/mcp/search rechaza sin query', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp/search',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /api/mcp/eligibility devuelve resultado con surface=mcp', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/mcp/eligibility',
      payload: { countryOrigin: 'argentina', arrivalDate: '2020-01-01' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.isEligible).toBe(true);
    expect(body.surface).toBe('mcp');
  });

  it('GET /api/mcp/procedure/nacionalidad_residencia/requirements devuelve checklist', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/mcp/procedure/nacionalidad_residencia/requirements',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.requirements).toBeDefined();
    expect(body.surface).toBe('mcp');
  });

  it('GET /api/mcp/procedure/vertical_inexistente/requirements devuelve 404', async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: 'GET',
      url: '/api/mcp/procedure/inexistente/requirements',
    });
    expect(res.statusCode).toBe(404);
  });
});
