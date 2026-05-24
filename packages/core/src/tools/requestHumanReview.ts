import { createDb, schema } from '@lexia/db';

let _coreDb: ReturnType<typeof createDb> | null = null;

function getCoreDb() {
  if (!_coreDb && process.env.DATABASE_URL) _coreDb = createDb(process.env.DATABASE_URL);
  return _coreDb;
}

export interface HumanReviewInput {
  userId: string;
  reason: string;
  conversationId?: string;
}

export interface HumanReviewResult {
  requestId: string;
  status: 'pending';
}

export async function requestHumanReview(input: HumanReviewInput): Promise<HumanReviewResult> {
  const db = getCoreDb();
  if (!db) return { requestId: '', status: 'pending' };

  try {
    const rows = await db
      .insert(schema.humanReviewRequests)
      .values({
        userId: input.userId,
        conversationId: input.conversationId,
        reason: input.reason,
        status: 'pending',
      })
      .returning({ id: schema.humanReviewRequests.id });

    return { requestId: rows[0]?.id ?? '', status: 'pending' };
  } catch {
    return { requestId: '', status: 'pending' };
  }
}
