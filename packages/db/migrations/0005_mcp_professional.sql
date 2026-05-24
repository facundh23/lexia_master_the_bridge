ALTER TABLE "users" ADD COLUMN "role" text NOT NULL DEFAULT 'user';

CREATE TABLE "personal_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "name" text NOT NULL,
  "last_used_at" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "personal_access_tokens" ADD CONSTRAINT "personal_access_tokens_token_hash_unique" UNIQUE("token_hash");

CREATE TABLE "professional_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "collegiate_number" text NOT NULL,
  "collegiate_body" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE "professional_verifications" ADD CONSTRAINT "professional_verifications_user_id_unique" UNIQUE("user_id");
