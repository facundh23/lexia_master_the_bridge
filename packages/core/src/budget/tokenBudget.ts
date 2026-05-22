import { createDb, schema } from '@lexia/db';
import { eq, and, sql } from 'drizzle-orm';

export const FREE_TIER_LIMIT = 50_000;

export interface BudgetStatus {
  allowed: boolean;
  tokensUsed: number;
  limit: number;
}

export function currentPeriodMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function checkBudget(
  userId: string,
  db: ReturnType<typeof createDb>,
): Promise<BudgetStatus> {
  const period = currentPeriodMonth();
  const rows = await db
    .select({ tokensUsed: schema.tokenUsage.tokensUsed })
    .from(schema.tokenUsage)
    .where(and(eq(schema.tokenUsage.userId, userId), eq(schema.tokenUsage.periodMonth, period)));

  const tokensUsed = rows[0]?.tokensUsed ?? 0;
  return { allowed: tokensUsed < FREE_TIER_LIMIT, tokensUsed, limit: FREE_TIER_LIMIT };
}

export async function recordUsage(
  userId: string,
  estimatedTokens: number,
  db: ReturnType<typeof createDb>,
): Promise<void> {
  const period = currentPeriodMonth();
  await db
    .insert(schema.tokenUsage)
    .values({ userId, periodMonth: period, tokensUsed: estimatedTokens })
    .onConflictDoUpdate({
      target: [schema.tokenUsage.userId, schema.tokenUsage.periodMonth],
      set: { tokensUsed: sql`${schema.tokenUsage.tokensUsed} + ${estimatedTokens}` },
    });
}
