import { describe, it, expect } from 'vitest';
import { logAgentAction, assertValidScope } from '../../src/nhi/auditLogger.js';
import { AGENT_IDENTITIES } from '../../src/nhi/agentIdentities.js';

describe('assertValidScope', () => {
  it('no lanza con un scope único válido', () => {
    expect(() =>
      assertValidScope({
        agentId: AGENT_IDENTITIES.normativa.id,
        action: 'normativa_response',
        userId: 'user-1',
        scopeUsed: 'read:rag_chunks',
      }),
    ).not.toThrow();
  });

  it('no lanza con múltiples scopes separados por coma (caso real de triage.ts)', () => {
    expect(() =>
      assertValidScope({
        agentId: AGENT_IDENTITIES.planner.id,
        action: 'triage_query',
        userId: 'user-1',
        scopeUsed: 'read:user_context,read:conversation_history',
      }),
    ).not.toThrow();
  });

  it('lanza si el scope no está declarado', () => {
    expect(() =>
      assertValidScope({
        agentId: AGENT_IDENTITIES.normativa.id,
        action: 'normativa_response',
        userId: 'user-1',
        scopeUsed: 'write:everything',
      }),
    ).toThrow(/scope\(s\) no declarado/);
  });

  it('lanza si el agentId no existe en el catálogo', () => {
    expect(() =>
      assertValidScope({
        agentId: 'agent:no_existe:v1',
        action: 'algo',
        userId: 'user-1',
        scopeUsed: 'read:input',
      }),
    ).toThrow(/identidad de agente desconocida/);
  });

  it('el throw ocurre incluso sin DATABASE_URL seteada', async () => {
    delete process.env.DATABASE_URL;
    await expect(
      logAgentAction({
        agentId: 'agent:no_existe:v1',
        action: 'algo',
        userId: 'user-1',
        scopeUsed: 'read:input',
      }),
    ).rejects.toThrow(/identidad de agente desconocida/);
  });

  it.each([
    ['triage.ts', AGENT_IDENTITIES.planner.id, 'read:user_context,read:conversation_history'],
    ['normativa/agent.ts', AGENT_IDENTITIES.normativa.id, 'read:rag_chunks'],
    ['eligibility/agent.ts', AGENT_IDENTITIES.eligibility.id, 'read:user_case'],
    ['ccse/agent.ts', AGENT_IDENTITIES.ccse.id, 'read:ccse_bank'],
    ['lexiaCore.ts (crisis detector)', AGENT_IDENTITIES.crisisDetector.id, 'read:input'],
  ])('caller real %s no rompe con el enforcement activado', (_label, agentId, scopeUsed) => {
    expect(() =>
      assertValidScope({ agentId, action: 'x', userId: 'user-1', scopeUsed }),
    ).not.toThrow();
  });
});

describe('logAgentAction — el fail-open de infraestructura sigue intacto', () => {
  it('no lanza si la DB no está disponible y el scope es válido', async () => {
    delete process.env.DATABASE_URL;
    await expect(
      logAgentAction({
        agentId: AGENT_IDENTITIES.normativa.id,
        action: 'normativa_response',
        userId: 'user-1',
        scopeUsed: 'read:rag_chunks',
      }),
    ).resolves.toBeUndefined();
  });
});
