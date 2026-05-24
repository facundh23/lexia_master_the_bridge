import { pgTable, text, timestamp, uuid, real, integer, jsonb, index } from 'drizzle-orm/pg-core';

export const evalRuns = pgTable(
  'eval_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    goldenSetVersion: text('golden_set_version').notNull(),
    vertical: text('vertical').notNull().default('nacionalidad_residencia'),
    totalCases: integer('total_cases').notNull(),
    factualityScoreAvg: real('factuality_score_avg'),
    citationValidityRate: real('citation_validity_rate'),
    jailbreakBlockRate: real('jailbreak_block_rate'),
    piiLeakRate: real('pii_leak_rate'),
    disclaimerPresentRate: real('disclaimer_present_rate'),
    crisisDetectionRecall: real('crisis_detection_recall'),
    p95LatencyMs: real('p95_latency_ms'),
    caseResults: jsonb('case_results').$type<EvalCaseResult[]>().notNull().default([]),
    triggeredBy: text('triggered_by').notNull().default('manual'),
    commitSha: text('commit_sha'),
  },
  (table) => ({
    runAtIdx: index('eval_runs_run_at_idx').on(table.runAt),
  }),
);

export interface EvalCaseResult {
  caseId: string;
  category: string;
  input: string;
  response: string;
  citations: string[];
  blocked: boolean;
  latencyMs: number;
  factualityScore: number;
  citationScore: number;
  safetyScore: number;
  toneScore: number;
  overallScore: number;
  judgeRationale: {
    factuality?: string;
    citation?: string;
    safety?: string;
    tone?: string;
  };
}
