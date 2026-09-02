import { createDb, schema } from '@lexia/db';
import { sql, eq } from 'drizzle-orm';
import { logAgentAction } from '../../nhi/auditLogger.js';
import { AGENT_IDENTITIES } from '../../nhi/agentIdentities.js';

let _coreDb: ReturnType<typeof createDb> | null = null;

function getCoreDb() {
  if (!_coreDb && process.env.DATABASE_URL) _coreDb = createDb(process.env.DATABASE_URL);
  return _coreDb;
}

export interface CCSEQuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  category: string;
  difficulty: string;
}

export interface CCSEQuizResult {
  attemptId: string;
  questions: CCSEQuizQuestion[];
}

export interface CCSEAnswer {
  questionId: string;
  selectedOption: number;
}

export interface CCSEQuestionResult {
  questionId: string;
  isCorrect: boolean;
  selectedOption: number;
  correctOption: number;
}

export interface CCSEEvalResult {
  attemptId: string;
  score: number;
  maxScore: number;
  passed: boolean;
  results: CCSEQuestionResult[];
}

export async function generateCcseQuiz(userId: string, size = 25): Promise<CCSEQuizResult> {
  const db = getCoreDb();
  if (!db) return { attemptId: '', questions: [] };

  try {
    const rawQuestions = await db
      .select()
      .from(schema.ccseQuestions)
      .orderBy(sql`RANDOM()`)
      .limit(size);

    const [attempt] = await db
      .insert(schema.ccseAttempts)
      .values({ userId, quizSize: rawQuestions.length, maxScore: rawQuestions.length })
      .returning({ id: schema.ccseAttempts.id });

    const attemptId = attempt?.id ?? '';

    const ccseIdentity = (
      AGENT_IDENTITIES as Record<string, { id: string; scopes: readonly string[] }>
    )['ccse'];
    if (ccseIdentity) {
      await logAgentAction({
        agentId: ccseIdentity.id,
        action: 'generate_quiz',
        userId,
        scopeUsed: 'read:ccse_bank',
        details: { quizSize: rawQuestions.length, attemptId },
      });
    }

    const questions: CCSEQuizQuestion[] = rawQuestions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      options: q.options as string[],
      category: q.category,
      difficulty: q.difficulty,
    }));

    return { attemptId, questions };
  } catch {
    return { attemptId: '', questions: [] };
  }
}

export async function evaluateCcseAnswers(
  attemptId: string,
  answers: CCSEAnswer[],
): Promise<CCSEEvalResult> {
  const db = getCoreDb();
  if (!db) return { attemptId, score: 0, maxScore: 0, passed: false, results: [] };

  try {
    const questionIds = answers.map((a) => a.questionId);
    const questionRows = await db
      .select({
        id: schema.ccseQuestions.id,
        correctOption: schema.ccseQuestions.correctOption,
      })
      .from(schema.ccseQuestions)
      .where(
        sql`${schema.ccseQuestions.id}::text = ANY(ARRAY[${sql.join(
          questionIds.map((id) => sql`${id}`),
          sql`, `,
        )}])`,
      );

    const correctMap = new Map(questionRows.map((q) => [q.id, q.correctOption]));

    const results: CCSEQuestionResult[] = answers.map((a) => {
      const correctOption = correctMap.get(a.questionId) ?? -1;
      return {
        questionId: a.questionId,
        isCorrect: a.selectedOption === correctOption,
        selectedOption: a.selectedOption,
        correctOption,
      };
    });

    const score = results.filter((r) => r.isCorrect).length;
    const maxScore = answers.length;
    const passed = maxScore > 0 && score / maxScore >= 0.6;

    if (results.length > 0) {
      await db.insert(schema.ccseAttemptQuestions).values(
        results.map((r) => ({
          attemptId,
          questionId: r.questionId,
          selectedOption: r.selectedOption,
          isCorrect: r.isCorrect,
        })),
      );
    }

    await db
      .update(schema.ccseAttempts)
      .set({ score, completedAt: new Date() })
      .where(eq(schema.ccseAttempts.id, attemptId));

    return { attemptId, score, maxScore, passed, results };
  } catch {
    return { attemptId, score: 0, maxScore: 0, passed: false, results: [] };
  }
}
