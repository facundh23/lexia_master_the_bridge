import { createDb, schema } from '@lexia/db';
import { gte, sql } from 'drizzle-orm';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env') });

const db = createDb(process.env.DATABASE_URL ?? '');

const CANARY_TOKENS = [
  'LEXIA_CANARY_ALPHA_7291',
  'LEXIA_CANARY_BETA_4853',
  'LEXIA_CANARY_GAMMA_9127',
  ...(process.env.LEXIA_CANARY_TOKEN ? [process.env.LEXIA_CANARY_TOKEN] : []),
];

async function detectCanaryTokens(): Promise<void> {
  console.log('[detector] Checking canary tokens in audit_log...');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: schema.auditLog.id,
      details: schema.auditLog.details,
      traceId: schema.auditLog.traceId,
    })
    .from(schema.auditLog)
    .where(gte(schema.auditLog.createdAt, since));

  for (const row of rows) {
    const detailsStr = JSON.stringify(row.details ?? '');
    for (const canary of CANARY_TOKENS) {
      if (detailsStr.includes(canary)) {
        console.error(
          `[ALERT] Canary token "${canary}" found in audit_log row ${row.id} (trace: ${row.traceId})`,
        );
        await db.insert(schema.auditLog).values({
          actorType: 'detector_worker',
          actorId: 'detector-v1',
          surface: 'system',
          action: 'canary_token_detected',
          targetType: 'audit_log',
          targetId: row.id,
          details: { canary, sourceRowId: row.id },
          traceId: row.traceId,
        });
      }
    }
  }

  console.log('[detector] Canary check complete.');
}

async function detectJailbreakSpikes(): Promise<void> {
  console.log('[detector] Checking jailbreak spike patterns...');

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const counts = await db
    .select({
      actorId: schema.auditLog.actorId,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.auditLog)
    .where(
      sql`${schema.auditLog.action} = 'input_blocked'
        AND ${schema.auditLog.details}->>'reason' = 'jailbreak_attempt'
        AND ${schema.auditLog.createdAt} >= ${since}`,
    )
    .groupBy(schema.auditLog.actorId);

  const JAILBREAK_THRESHOLD = 5;

  for (const { actorId, count } of counts) {
    if (count >= JAILBREAK_THRESHOLD && actorId) {
      console.warn(`[ALERT] User ${actorId} has ${count} jailbreak attempts in 24h`);
      await db.insert(schema.auditLog).values({
        actorType: 'detector_worker',
        actorId: 'detector-v1',
        surface: 'system',
        action: 'jailbreak_spike_detected',
        targetType: 'user',
        targetId: actorId,
        details: { count, window: '24h', threshold: JAILBREAK_THRESHOLD },
      });
    }
  }

  console.log('[detector] Jailbreak spike check complete.');
}

async function main(): Promise<void> {
  console.log('[detector] Starting security scan...');
  const start = Date.now();

  try {
    await detectCanaryTokens();
    await detectJailbreakSpikes();
    console.log(`[detector] Scan complete in ${Date.now() - start}ms`);
  } catch (err) {
    console.error('[detector] Scan failed:', err);
    process.exit(1);
  }

  process.exit(0);
}

main();
