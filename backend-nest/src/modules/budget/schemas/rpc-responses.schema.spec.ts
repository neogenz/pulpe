import { describe, expect, it } from 'bun:test';
import { validateGenerateBudgetsResponse } from './rpc-responses.schema';

const budgetId = '11111111-1111-4111-8111-111111111111';

describe('validateGenerateBudgetsResponse', () => {
  it('accepts the exact atomic generation result', () => {
    expect(
      validateGenerateBudgetsResponse({
        created_budget_ids: [budgetId],
        skipped_months: [{ month: 2, year: 2026 }],
      }),
    ).toEqual({
      created_budget_ids: [budgetId],
      skipped_months: [{ month: 2, year: 2026 }],
    });
  });

  it.each([
    { created_budget_ids: [budgetId] },
    { created_budget_ids: ['not-a-uuid'], skipped_months: [] },
    { created_budget_ids: [], skipped_months: [{ month: 13, year: 2026 }] },
    { created_budget_ids: [], skipped_months: [], extra: true },
  ])('rejects incomplete or malformed results', (result) => {
    expect(() => validateGenerateBudgetsResponse(result)).toThrow();
  });
});
