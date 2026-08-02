import { describe, it, expect } from 'bun:test';
import {
  applySavingsGoalPlanLineSchema,
  applySavingsGoalPlanLineListSchema,
  PLAN_LINE_CHECKED_RPC_MESSAGE,
  PLAN_LINE_NOT_LINKED_RPC_MESSAGE,
  PLAN_LINE_PAST_RPC_MESSAGE,
  RECONCILIATION_CONFLICT_RPC_MESSAGE,
  reconcileSavingsGoalTargetDatePatchSchema,
  savingsGoalDeletionImpactRpcSchema,
  savingsGoalDeletionResultRpcSchema,
  SAVINGS_GOAL_DELETION_IMPACT_CHANGED_RPC_MESSAGE,
} from './rpc-payload.schemas';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

const validLine = {
  budget_line_id: UUID,
  amount: 'AES-cipher-amount',
};

describe('applySavingsGoalPlanLineSchema', () => {
  it('accepts a valid ciphertext line update', () => {
    expect(() => applySavingsGoalPlanLineSchema.parse(validLine)).not.toThrow();
  });

  it('rejects an unknown key (strict — a typo must not silently NULL a column)', () => {
    expect(() =>
      applySavingsGoalPlanLineSchema.parse({
        ...validLine,
        savings_goal_id: UUID,
      }),
    ).toThrow();
  });

  it('rejects a non-uuid budget_line_id', () => {
    expect(() =>
      applySavingsGoalPlanLineSchema.parse({
        ...validLine,
        budget_line_id: 'not-a-uuid',
      }),
    ).toThrow();
  });

  it('rejects an empty amount ciphertext', () => {
    expect(() =>
      applySavingsGoalPlanLineSchema.parse({ ...validLine, amount: '' }),
    ).toThrow();
  });

  it('validates a list of line updates', () => {
    expect(applySavingsGoalPlanLineListSchema.parse([validLine])).toHaveLength(
      1,
    );
  });
});

describe('RPC P0001 message constants', () => {
  // These are pinned verbatim against the SQL RAISEs in migration
  // 20260706120000_apply_savings_goal_plan (the SQL↔TS coupling contract).
  it('mirror the exact strings the RPC RAISEs', () => {
    expect(PLAN_LINE_NOT_LINKED_RPC_MESSAGE).toBe('Plan line not linked');
    expect(PLAN_LINE_CHECKED_RPC_MESSAGE).toBe('Plan line already checked');
    expect(PLAN_LINE_PAST_RPC_MESSAGE).toBe('Plan line in past period');
  });
});

describe('reconcileSavingsGoalTargetDatePatchSchema', () => {
  const patch = {
    name: 'Maison proche',
    target_date: '2030-03-15',
    target_amount: 'AES-cipher-target',
    initial_amount: 'AES-cipher-initial',
    status: 'ACTIVE' as const,
  };

  it('accepts an encrypted strict patch carrying the new target date', () => {
    expect(reconcileSavingsGoalTargetDatePatchSchema.parse(patch)).toEqual(
      patch,
    );
  });

  it('rejects plaintext financial amounts', () => {
    expect(() =>
      reconcileSavingsGoalTargetDatePatchSchema.parse({
        ...patch,
        target_amount: 5000,
      }),
    ).toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() =>
      reconcileSavingsGoalTargetDatePatchSchema.parse({
        ...patch,
        reconciliation: {},
      }),
    ).toThrow();
  });

  it('pins the transaction drift error message', () => {
    expect(RECONCILIATION_CONFLICT_RPC_MESSAGE).toBe(
      'Savings goal reconciliation conflict',
    );
  });
});

describe('PUL-319 deletion RPC payloads', () => {
  const now = '2026-07-27T10:00:00+00:00';

  it('validates encrypted impact rows and rejects unknown keys', () => {
    const impact = {
      goalId: UUID,
      templateLines: [],
      budgets: [
        {
          budgetId: UUID,
          month: 7,
          year: 2026,
          lines: [
            {
              lineId: UUID,
              name: 'Épargne',
              amount: 'ciphertext',
              recurrence: 'fixed',
              checkedAt: null,
              updatedAt: now,
              transactions: [],
            },
          ],
        },
      ],
      withdrawals: [
        {
          transactionId: UUID,
          budgetId: UUID,
          name: 'Retrait Voyage',
          transactionDate: now,
          amount: 'ciphertext',
        },
      ],
      revision: {
        templateLines: [],
        budgetLines: [{ id: UUID, updatedAt: now }],
        transactions: [],
      },
    };

    expect(() =>
      savingsGoalDeletionImpactRpcSchema.parse(impact),
    ).not.toThrow();
    expect(() =>
      savingsGoalDeletionImpactRpcSchema.parse({ ...impact, plaintext: 100 }),
    ).toThrow();
  });

  it('validates touched budget rows', () => {
    expect(
      savingsGoalDeletionResultRpcSchema.parse([{ budget_id: UUID }]),
    ).toEqual([{ budget_id: UUID }]);
  });

  it('pins the revision conflict message to the SQL migration', () => {
    expect(SAVINGS_GOAL_DELETION_IMPACT_CHANGED_RPC_MESSAGE).toBe(
      'Savings goal deletion impact changed',
    );
  });
});
