CREATE TABLE "eval_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_at" timestamptz NOT NULL DEFAULT now(),
  "golden_set_version" text NOT NULL,
  "vertical" text NOT NULL DEFAULT 'nacionalidad_residencia',
  "total_cases" integer NOT NULL,
  "factuality_score_avg" real,
  "citation_validity_rate" real,
  "jailbreak_block_rate" real,
  "pii_leak_rate" real,
  "disclaimer_present_rate" real,
  "crisis_detection_recall" real,
  "p95_latency_ms" real,
  "case_results" jsonb NOT NULL DEFAULT '[]',
  "triggered_by" text NOT NULL DEFAULT 'manual',
  "commit_sha" text
);
CREATE INDEX "eval_runs_run_at_idx" ON "eval_runs" ("run_at");
