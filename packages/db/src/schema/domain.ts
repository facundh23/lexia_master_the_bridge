import {
  boolean,
  date,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const cases = pgTable('cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  verticalSlug: text('vertical_slug').notNull().default('nacionalidad_residencia'),
  countryOrigin: text('country_origin'), // F3: pgcrypto encryption
  arrivalDate: date('arrival_date'),
  residenceStatus: text('residence_status'),
  hasChildren: boolean('has_children').notNull().default(false),
  status: text('status').notNull().default('active'), // active | archived
  notes: text('notes'), // F3: pgcrypto encryption
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  title: text('title'),
  surface: text('surface').notNull().default('web'), // web | mcp
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // user | assistant
    content: text('content').notNull(),
    citations: json('citations').$type<string[]>().default([]),
    traceId: text('trace_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    convIdx: index('messages_conversation_idx').on(table.conversationId),
  }),
);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(), // F3: pgcrypto encryption
  minioKey: text('minio_key'),
  status: text('status').notNull().default('pending'), // pending | sanitized | indexed | rejected
  sizeBytes: integer('size_bytes'),
  mimeType: text('mime_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
