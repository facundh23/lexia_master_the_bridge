import { pgTable, text, timestamp, jsonb, uuid, index } from 'drizzle-orm/pg-core';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorType: text('actor_type').notNull(),
    actorId: text('actor_id'),
    surface: text('surface').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details'),
    traceId: text('trace_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorIdx: index('audit_log_actor_idx').on(table.actorType, table.actorId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
    traceIdIdx: index('audit_log_trace_id_idx').on(table.traceId),
  }),
);
