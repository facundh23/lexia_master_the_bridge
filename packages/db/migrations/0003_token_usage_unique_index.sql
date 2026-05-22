DROP INDEX IF EXISTS "token_usage_user_period_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "token_usage_user_period_idx" ON "token_usage" USING btree ("user_id","period_month");
