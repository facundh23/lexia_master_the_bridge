import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const verticals = pgTable('verticals', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  corpusNamespace: text('corpus_namespace').notNull(),
  version: text('version').notNull().default('0.0.0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const tokenUsage = pgTable(
  'token_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodMonth: text('period_month').notNull(), // e.g. '2026-05'
    tokensUsed: integer('tokens_used').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userPeriodIdx: uniqueIndex('token_usage_user_period_idx').on(table.userId, table.periodMonth),
  }),
);
