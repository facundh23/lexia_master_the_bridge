import { describe, it, expect } from 'vitest';
import { currentPeriodMonth, FREE_TIER_LIMIT } from '../../src/budget/tokenBudget.js';

describe('tokenBudget', () => {
  it('currentPeriodMonth returns YYYY-MM format', () => {
    const period = currentPeriodMonth();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('currentPeriodMonth returns current year and month', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(currentPeriodMonth()).toBe(expected);
  });

  it('FREE_TIER_LIMIT is 50000', () => {
    expect(FREE_TIER_LIMIT).toBe(50_000);
  });
});
