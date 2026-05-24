-- Migration 0004: CCSE tables + reminders + human review requests
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccse_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question_text" text NOT NULL,
  "options" json NOT NULL,
  "correct_option" integer NOT NULL,
  "category" text NOT NULL,
  "difficulty" text DEFAULT 'medium' NOT NULL,
  "verified_by_human" boolean DEFAULT false NOT NULL,
  "source" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccse_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "quiz_size" integer DEFAULT 25 NOT NULL,
  "score" integer,
  "max_score" integer NOT NULL,
  "duration_seconds" integer,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ccse_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ccse_attempt_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attempt_id" uuid NOT NULL,
  "question_id" uuid NOT NULL,
  "selected_option" integer,
  "is_correct" boolean,
  CONSTRAINT "ccse_attempt_questions_attempt_id_ccse_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "ccse_attempts"("id") ON DELETE CASCADE,
  CONSTRAINT "ccse_attempt_questions_question_id_ccse_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "ccse_questions"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "case_id" uuid,
  "template_slug" text NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "notified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "reminders_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "human_review_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "conversation_id" uuid,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "reviewed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "human_review_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "human_review_requests_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ccse_attempts_user_idx" ON "ccse_attempts" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ccse_attempt_questions_attempt_idx" ON "ccse_attempt_questions" ("attempt_id");
