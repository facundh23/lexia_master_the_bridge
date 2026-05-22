import { createDb, schema } from '@lexia/db';

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

export async function logAgentAction(entry: AgentAuditEntry): Promise<void> {
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
