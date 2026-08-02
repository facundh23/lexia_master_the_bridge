import { createDb, schema } from '@lexia/db';
import { AGENT_IDENTITIES, type AgentIdentity } from './agentIdentities.js';

let _db: ReturnType<typeof createDb> | null = null;

function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = createDb(process.env.DATABASE_URL);
  }
  return _db;
}

export interface AgentAuditEntry {
  agentId: string;
  action: string;
  userId: string;
  traceId?: string;
  scopeUsed: string;
  details?: Record<string, unknown>;
}

function findIdentityById(agentId: string): AgentIdentity | undefined {
  return (Object.values(AGENT_IDENTITIES) as AgentIdentity[]).find(
    (identity) => identity.id === agentId,
  );
}

export function assertValidScope(entry: AgentAuditEntry): void {
  const identity = findIdentityById(entry.agentId);
  if (!identity) {
    throw new Error(`NHI scope violation: identidad de agente desconocida "${entry.agentId}"`);
  }
  const usedScopes = entry.scopeUsed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = usedScopes.filter((s) => !identity.scopes.includes(s));
  if (invalid.length > 0) {
    throw new Error(
      `NHI scope violation: el agente "${identity.name}" usó scope(s) no declarado(s): ${invalid.join(', ')}`,
    );
  }
}

export async function logAgentAction(entry: AgentAuditEntry): Promise<void> {
  assertValidScope(entry);

  const db = getDb();
  if (!db) return;
  try {
    await db.insert(schema.auditLog).values({
      actorType: 'agent',
      actorId: entry.agentId,
      surface: 'system',
      action: entry.action,
      targetType: 'user',
      targetId: entry.userId,
      details: {
        scope_used: entry.scopeUsed,
        delegated_by_user: entry.userId,
        ...entry.details,
      },
      traceId: entry.traceId,
    });
  } catch {
    // fail-open: si la DB no está disponible, no interrumpir el flujo principal
  }
}
