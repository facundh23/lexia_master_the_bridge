import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capturar inserts en audit_log
const auditInserts: any[] = [];

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
  runNormativaAgent: vi.fn().mockResolvedValue({ response: 'ok', citations: [] }),
  computeEligibility: vi.fn().mockReturnValue({
    yearsRequired: 2,
    isEligible: true,
    specialCase: 'iberoamerican',
    legalBasis: 'Art. 22 CC',
    notes: [],
  }),
  nacionalidadResidencia: {
    slug: 'nacionalidad_residencia',
    name: 'Test',
    intake: { fields: [] },
    corpus: { sources: [] },
    reminders: [],
  },
}));
vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({
    insert: vi.fn((table: any) => ({
      values: vi.fn((row: any) => {
        auditInserts.push({ table, row });
        return Promise.resolve([]);
      }),
    })),
  })),
  schema: { auditLog: 'auditLog' },
}));
vi.mock('../src/auth.js', () => ({ auth: { handler: vi.fn(), api: { getSession: vi.fn() } } }));
vi.mock('../src/mailer.js', () => ({ mailer: { sendMail: vi.fn() } }));

import { buildServer } from '../src/server.js';

describe('MCP audit log', () => {
  beforeEach(() => {
    auditInserts.length = 0;
  });

  it('POST /api/mcp/search inserta fila con surface=mcp y action=mcp_search', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/api/mcp/search',
      payload: { query: 'test', vertical: 'nacionalidad_residencia' },
    });
    const row = auditInserts.find(
      (e) => e.row?.surface === 'mcp' && e.row?.action === 'mcp_search',
    );
    expect(row).toBeDefined();
    expect(row.row.actorType).toBe('user');
    expect(row.row.actorId).toBe('pro-user');
  });

  it('POST /api/mcp/eligibility inserta fila con surface=mcp y action=mcp_eligibility', async () => {
    const app = await buildServer();
    await app.inject({
      method: 'POST',
      url: '/api/mcp/eligibility',
      payload: { countryOrigin: 'argentina' },
    });
    const row = auditInserts.find(
      (e) => e.row?.surface === 'mcp' && e.row?.action === 'mcp_eligibility',
    );
    expect(row).toBeDefined();
  });
});
