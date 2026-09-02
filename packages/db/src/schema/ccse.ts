import { boolean, index, integer, json, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export const ccseQuestions = pgTable('ccse_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionText: text('question_text').notNull(),
  options: json('options').$type<string[]>().notNull(),
  correctOption: integer('correct_option').notNull(),
  category: text('category').notNull(),
  difficulty: text('difficulty').notNull().default('medium'),
  verifiedByHuman: boolean('verified_by_human').notNull().default(false),
  source: text('source'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ccseAttempts = pgTable(
  'ccse_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    quizSize: integer('quiz_size').notNull().default(25),
    score: integer('score'),
    maxScore: integer('max_score').notNull(),
    durationSeconds: integer('duration_seconds'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('ccse_attempts_user_idx').on(table.userId),
  }),
);

export const ccseAttemptQuestions = pgTable(
  'ccse_attempt_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => ccseAttempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => ccseQuestions.id, { onDelete: 'restrict' }),
    selectedOption: integer('selected_option'),
    isCorrect: boolean('is_correct'),
  },
  (table) => ({
    attemptIdx: index('ccse_attempt_questions_attempt_idx').on(table.attemptId),
  }),
);
