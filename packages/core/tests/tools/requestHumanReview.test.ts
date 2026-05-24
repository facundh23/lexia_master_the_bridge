import { describe, it, expect, vi } from 'vitest';

const mockInsert = vi.fn();

vi.mock('@lexia/db', () => ({
  createDb: vi.fn(() => ({ insert: mockInsert })),
  schema: { humanReviewRequests: {} },
}));

import { requestHumanReview } from '../../src/tools/requestHumanReview.js';

describe('requestHumanReview', () => {
  it('returns pending status when DB unavailable', async () => {
    const result = await requestHumanReview({ userId: 'u-1', reason: 'Quiero revisión humana' });
    expect(result.status).toBe('pending');
    expect(result.requestId).toBe('');
  });

  it('creates request and returns id when DB available', async () => {
    process.env.DATABASE_URL = 'postgresql://test';
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'req-123' }]),
      }),
    });

    const result = await requestHumanReview({
      userId: 'u-1',
      reason: 'Necesito revisión de mi caso',
      conversationId: 'conv-1',
    });

    expect(result.requestId).toBe('req-123');
    expect(result.status).toBe('pending');
    delete process.env.DATABASE_URL;
  });
});
