import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  })),
  schema: {
    ccseQuestions: { id: {}, correctOption: {}, verifiedByHuman: {} },
    ccseAttempts: { id: {}, userId: {} },
    ccseAttemptQuestions: {},
  },
}));

import { generateCcseQuiz, evaluateCcseAnswers } from '../../src/agents/ccse/agent.js';

describe('generateCcseQuiz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  it('returns empty quiz when DB unavailable', async () => {
    const result = await generateCcseQuiz('user-1', 25);
    expect(result.questions).toHaveLength(0);
    expect(result.attemptId).toBe('');
  });

  it('does not include correctOption in returned questions', async () => {
    process.env.DATABASE_URL = 'postgresql://test';

    const mockQuestions = [
      {
        id: 'q-1',
        questionText: '¿Test?',
        options: ['A', 'B', 'C', 'D'],
        correctOption: 2,
        category: 'constitucion',
        difficulty: 'easy',
        verifiedByHuman: false,
        source: null,
        createdAt: new Date(),
      },
    ];

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(mockQuestions),
        }),
      }),
    });

    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'attempt-1' }]),
      }),
    });

    const result = await generateCcseQuiz('user-1', 1);
    expect(result.attemptId).toBe('attempt-1');
    expect(result.questions).toHaveLength(1);
    expect((result.questions[0] as Record<string, unknown>)['correctOption']).toBeUndefined();
  });
});

describe('evaluateCcseAnswers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  it('returns zero score when DB unavailable', async () => {
    const result = await evaluateCcseAnswers('attempt-1', [
      { questionId: 'q-1', selectedOption: 0 },
    ]);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });
});
