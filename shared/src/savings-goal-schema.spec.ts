import { describe, expect, test } from 'vitest';
import {
  savingsGoalCreateSchema,
  savingsGoalFutureLinesQuerySchema,
  savingsGoalDeletionCommandSchema,
  savingsGoalDeletionImpactSchema,
  savingsGoalPlanApplySchema,
  savingsGoalProgressSchema,
  savingsGoalUpdateSchema,
  savingsGoalSchema,
  templateLineCreateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
  templateLineSchema,
  type SavingsGoalPlanApply,
} from '../schemas.js';

const UUID = '00000000-0000-0000-0000-000000000000';
const UUID_2 = '00000000-0000-4000-8000-000000000002';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

function isoDateOffsetDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoDateOffsetMonths(months: number): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 15),
  )
    .toISOString()
    .slice(0, 10);
}

describe('PUL-12 — savingsGoalCreateSchema', () => {
  const base = {
    name: 'Vacances 2027',
    targetAmount: 3000,
    targetDate: isoDateOffsetDays(30),
  };

  test('rejects priority (removed from product)', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      priority: 'HIGH',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.code === 'unrecognized_keys'),
      ).toBe(true);
    }
  });

  test('rejects a past targetDate', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      targetDate: isoDateOffsetDays(-1),
    });
    expect(result.success).toBe(false);
  });

  test("accepts today's date (deadline month is still contributive)", () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      targetDate: isoDateOffsetDays(0),
    });
    expect(result.success).toBe(true);
  });

  test('accepts a future targetDate and defaults status to ACTIVE', () => {
    const result = savingsGoalCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ACTIVE');
    }
  });

  test('rejects a non-ISO-date targetDate (length is not a date)', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      targetDate: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  test('accepts the 120th contributive period and rejects the next one', () => {
    expect(
      savingsGoalCreateSchema.safeParse({
        ...base,
        targetDate: isoDateOffsetMonths(119),
      }).success,
    ).toBe(true);
    expect(
      savingsGoalCreateSchema.safeParse({
        ...base,
        targetDate: isoDateOffsetMonths(120),
      }).success,
    ).toBe(false);
  });
});

describe('PUL-12 — savingsGoalSchema (read) drops priority', () => {
  test('parses a row without priority', () => {
    const now = new Date().toISOString();
    const result = savingsGoalSchema.safeParse({
      id: UUID,
      userId: UUID,
      name: 'Maison',
      targetAmount: 100000,
      targetDate: isoDateOffsetDays(365),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('priority' in result.data).toBe(false);
    }
  });
});

describe('PUL-12 — savingsGoalUpdateSchema keeps PATCH semantics', () => {
  test('does not default status to ACTIVE on partial updates', () => {
    const result = savingsGoalUpdateSchema.safeParse({ name: 'Maison bis' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('status' in result.data).toBe(false);
    }
  });

  test('accepts an existing past targetDate so expired goals stay editable', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      targetDate: isoDateOffsetDays(-1),
    });
    expect(result.success).toBe(true);
  });

  test('rejects an explicitly updated targetDate beyond the 120th period', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      targetDate: isoDateOffsetMonths(120),
    });
    expect(result.success).toBe(false);
  });
});

describe('PUL-314 — optional savings interval contract', () => {
  test('accepts a creation with only the required name', () => {
    const result = savingsGoalCreateSchema.safeParse({ name: 'Matelas' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: 'Matelas', status: 'ACTIVE' });
    }
  });

  test.each([
    {},
    { startDate: isoDateOffsetDays(1) },
    { targetAmount: 3000 },
    { targetDate: isoDateOffsetDays(30) },
    {
      startDate: isoDateOffsetDays(1),
      targetAmount: 3000,
      targetDate: isoDateOffsetDays(30),
    },
  ])('accepts independent optional fields: %o', (fields) => {
    expect(
      savingsGoalCreateSchema.safeParse({ name: 'Matelas', ...fields }).success,
    ).toBe(true);
  });

  test('rejects startDate after targetDate when both are present', () => {
    expect(
      savingsGoalCreateSchema.safeParse({
        name: 'Matelas',
        startDate: isoDateOffsetDays(31),
        targetDate: isoDateOffsetDays(30),
      }).success,
    ).toBe(false);
  });

  test('accepts omission, null, or a value for each interval field on update', () => {
    expect(savingsGoalUpdateSchema.safeParse({}).success).toBe(true);
    expect(
      savingsGoalUpdateSchema.safeParse({
        startDate: null,
        targetAmount: null,
        targetDate: null,
      }).success,
    ).toBe(true);
    expect(
      savingsGoalUpdateSchema.safeParse({
        startDate: isoDateOffsetDays(1),
        targetAmount: 3000,
        targetDate: isoDateOffsetDays(30),
      }).success,
    ).toBe(true);
  });

  test('accepts an explicit freeze/remove reconciliation on update', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      targetDate: isoDateOffsetDays(15),
      reconciliation: {
        mode: 'freeze',
        budgetLineIds: [UUID],
      },
    });

    expect(result.success).toBe(true);
  });

  test('rejects duplicate line IDs in an update reconciliation', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      targetDate: isoDateOffsetDays(15),
      reconciliation: {
        mode: 'remove',
        budgetLineIds: [UUID, UUID],
      },
    });

    expect(result.success).toBe(false);
  });

  test('accepts an exact reconciliation snapshot containing more than 120 lines', () => {
    const result = savingsGoalUpdateSchema.safeParse({
      targetDate: isoDateOffsetDays(15),
      reconciliation: {
        mode: 'remove',
        budgetLineIds: Array.from({ length: 121 }, () => crypto.randomUUID()),
      },
    });

    expect(result.success).toBe(true);
  });

  test('validates the optional targetDate preview query strictly', () => {
    expect(savingsGoalFutureLinesQuerySchema.safeParse({}).success).toBe(true);
    expect(
      savingsGoalFutureLinesQuerySchema.safeParse({
        targetDate: isoDateOffsetDays(15),
      }).success,
    ).toBe(true);
    expect(
      savingsGoalFutureLinesQuerySchema.safeParse({
        targetDate: 'not-a-date',
      }).success,
    ).toBe(false);
  });

  test('reads an objective without start, target, or deadline', () => {
    const now = new Date().toISOString();
    const result = savingsGoalSchema.safeParse({
      id: UUID,
      userId: UUID,
      name: 'Matelas',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    expect(result.success).toBe(true);
  });

  test('accepts null target/deadline metrics and the planned projection', () => {
    const result = savingsGoalProgressSchema.safeParse({
      goalId: UUID,
      status: 'ACTIVE',
      startDate: null,
      targetAmount: null,
      targetDate: null,
      plannedCumulative: 0,
      plannedProjection: 500,
      confirmed: 0,
      achievementPercent: null,
      monthsElapsed: 1,
      monthsRemaining: null,
      isOverdue: false,
      pace: 0,
      confirmedPace: 0,
      required: null,
      projected: null,
      paceStatus: null,
      suggestCompletion: null,
      linkedLineCount: 0,
      cumulativeGap: 0,
      estimatedCompletion: null,
      months: [],
      originalTargetAmount: null,
      originalCurrency: null,
      targetCurrency: null,
      exchangeRate: null,
    });

    expect(result.success).toBe(true);
  });
});

describe('PUL-293 — savingsGoalCreateSchema.initialAmount', () => {
  const base = {
    name: 'Vacances 2027',
    targetAmount: 3000,
    targetDate: isoDateOffsetDays(30),
  };

  test('accepts an absent initialAmount', () => {
    const result = savingsGoalCreateSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('initialAmount' in result.data).toBe(false);
    }
  });

  test('accepts initialAmount 0', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      initialAmount: 0,
    });
    expect(result.success).toBe(true);
  });

  test('accepts a positive initialAmount', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      initialAmount: 500,
    });
    expect(result.success).toBe(true);
  });

  test('rejects a negative initialAmount', () => {
    const result = savingsGoalCreateSchema.safeParse({
      ...base,
      initialAmount: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('PUL-293 — savingsGoalUpdateSchema.initialAmount', () => {
  test('accepts an absent initialAmount (PATCH semantics: not sent = unchanged)', () => {
    const result = savingsGoalUpdateSchema.safeParse({ name: 'Maison bis' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('initialAmount' in result.data).toBe(false);
    }
  });

  test('accepts initialAmount 0 (explicit erase of the stock)', () => {
    const result = savingsGoalUpdateSchema.safeParse({ initialAmount: 0 });
    expect(result.success).toBe(true);
  });

  test('rejects a negative initialAmount', () => {
    const result = savingsGoalUpdateSchema.safeParse({ initialAmount: -1 });
    expect(result.success).toBe(false);
  });
});

describe('PUL-293 — savingsGoalProgressSchema.initialAmount default', () => {
  const validProgress = {
    goalId: UUID,
    status: 'ACTIVE' as const,
    targetAmount: 1000,
    targetDate: isoDateOffsetDays(30),
    plannedCumulative: 100,
    plannedProjection: 1000,
    confirmed: 100,
    achievementPercent: 10,
    monthsElapsed: 1,
    monthsRemaining: 1,
    isOverdue: false,
    pace: 100,
    confirmedPace: 100,
    required: 100,
    projected: 1000,
    paceStatus: 'on_track' as const,
    suggestCompletion: false,
    linkedLineCount: 1,
    cumulativeGap: 0,
    estimatedCompletion: null,
    months: [],
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
  };

  test('parses a payload without initialAmount and defaults to 0 (existing mocks stay valid)', () => {
    const result = savingsGoalProgressSchema.safeParse(validProgress);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initialAmount).toBe(0);
    }
  });
});

describe('PUL-319 — savings goal deletion contract', () => {
  const now = new Date().toISOString();
  const emptyRevision = {
    templateLines: [],
    budgetLines: [],
    transactions: [],
  };

  test.each([
    'goal_only',
    'goal_and_forecasts',
    'goal_forecasts_and_transactions',
  ] as const)('accepts the explicit %s mode', (mode) => {
    expect(
      savingsGoalDeletionCommandSchema.safeParse({
        mode,
        revision: emptyRevision,
      }).success,
    ).toBe(true);
  });

  test('rejects duplicate entities in the preview revision', () => {
    const duplicate = { id: UUID, updatedAt: now };
    expect(
      savingsGoalDeletionCommandSchema.safeParse({
        mode: 'goal_only',
        revision: {
          ...emptyRevision,
          budgetLines: [duplicate, duplicate],
        },
      }).success,
    ).toBe(false);
  });

  test('accepts a non-empty unique revision and rejects an unknown mode', () => {
    expect(
      savingsGoalDeletionCommandSchema.safeParse({
        mode: 'goal_and_forecasts',
        revision: {
          ...emptyRevision,
          budgetLines: [{ id: UUID, updatedAt: now }],
        },
      }).success,
    ).toBe(true);
    expect(
      savingsGoalDeletionCommandSchema.safeParse({
        mode: 'delete_everything',
        revision: emptyRevision,
      }).success,
    ).toBe(false);
  });

  test('accepts a complete impact spanning 76 budgets without truncation', () => {
    const budgets = Array.from({ length: 76 }, (_, index) => {
      const lineId = uuid(index + 100);
      return {
        budgetId: uuid(index + 1),
        month: (index % 12) + 1,
        year: 2026 + Math.floor(index / 12),
        lines: [
          {
            lineId,
            name: `Épargne ${index + 1}`,
            amount: 100,
            recurrence: 'fixed' as const,
            checkedAt: null,
            updatedAt: now,
            transactions: [],
          },
        ],
      };
    });
    const result = savingsGoalDeletionImpactSchema.safeParse({
      goalId: UUID,
      summary: {
        templateLineCount: 1,
        templateLineTotal: 100,
        budgetCount: 76,
        budgetLineCount: 76,
        budgetLineTotal: 7600,
        transactionCount: 0,
        transactionTotal: 0,
      },
      templateLines: [
        {
          lineId: UUID_2,
          templateId: uuid(999),
          templateName: 'Mois Type',
          name: 'Épargne',
          amount: 100,
          recurrence: 'fixed',
          updatedAt: now,
        },
      ],
      budgets,
      revision: {
        templateLines: [{ id: UUID_2, updatedAt: now }],
        budgetLines: budgets.map(({ lines }) => ({
          id: lines[0].lineId,
          updatedAt: now,
        })),
        transactions: [],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budgets).toHaveLength(76);
      expect(result.data.summary.budgetLineTotal).toBe(7600);
    }
  });
});

describe('PUL-12 — savingsGoalPlanApplySchema final contract', () => {
  test('accepts a signed plan-only withdrawal while keeping contribution amounts non-negative', () => {
    const withdrawal = savingsGoalPlanApplySchema.safeParse({
      planWithdrawalAdjustments: [{ month: 9, year: 2026, amount: -4500 }],
    });
    const invalidContribution = savingsGoalPlanApplySchema.safeParse({
      monthAdjustments: [{ budgetLineId: UUID, amount: -4500 }],
    });

    expect(withdrawal.success).toBe(true);
    expect(invalidContribution.success).toBe(false);
  });

  test('accepts zero as the explicit removal of a plan-only withdrawal', () => {
    expect(
      savingsGoalPlanApplySchema.safeParse({
        planWithdrawalAdjustments: [{ month: 9, year: 2026, amount: 0 }],
      }).success,
    ).toBe(true);
  });

  test('rejects templateAdjustments as an unknown key', () => {
    const result = savingsGoalPlanApplySchema.safeParse({
      monthAdjustments: [{ budgetLineId: UUID, amount: 1000 }],
      templateAdjustments: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.code === 'unrecognized_keys'),
      ).toBe(true);
    }
  });

  test('accepts a typed web payload with a materialized adjustment', () => {
    const input: SavingsGoalPlanApply = {
      monthAdjustments: [{ budgetLineId: UUID, amount: 0 }],
      missingMonthAdjustments: [],
    };

    const result = savingsGoalPlanApplySchema.safeParse(input);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.missingMonthAdjustments).toEqual([]);
  });

  test('tolerates a zero-amount missing forecast from an older client', () => {
    const result = savingsGoalPlanApplySchema.safeParse({
      monthAdjustments: [{ budgetLineId: UUID, amount: 250 }],
      missingMonthAdjustments: [{ month: 8, year: 2026, amount: 0 }],
    });

    // Rejecting the zero would take the valid adjustment down with it; the
    // use case drops the zero instead, so nothing is ever created at 0.
    expect(result.success).toBe(true);
  });

  test('accepts missing budgets described by unique periods', () => {
    const result = savingsGoalPlanApplySchema.safeParse({
      monthAdjustments: [],
      missingMonthAdjustments: [
        { month: 8, year: 2026, amount: 1000 },
        { month: 9, year: 2026, amount: 1000 },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('rejects duplicate missing periods', () => {
    expect(
      savingsGoalPlanApplySchema.safeParse({
        missingMonthAdjustments: [
          { month: 8, year: 2026, amount: 1000 },
          { month: 8, year: 2026, amount: 900 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('PUL-12 — template line schemas carry savingsGoalId', () => {
  test('templateLineCreateSchema accepts a uuid savingsGoalId', () => {
    const result = templateLineCreateSchema.safeParse({
      templateId: UUID,
      savingsGoalId: UUID,
      name: 'Épargne maison',
      amount: 500,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineCreateSchema accepts a null savingsGoalId', () => {
    const result = templateLineCreateSchema.safeParse({
      templateId: UUID,
      savingsGoalId: null,
      name: 'Loyer',
      amount: 1500,
      kind: 'expense',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineCreateSchema omitting savingsGoalId is valid', () => {
    const result = templateLineCreateSchema.safeParse({
      templateId: UUID,
      name: 'Salaire',
      amount: 5000,
      kind: 'income',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineCreateWithoutTemplateIdSchema accepts savingsGoalId', () => {
    const result = templateLineCreateWithoutTemplateIdSchema.safeParse({
      savingsGoalId: UUID,
      name: 'Épargne',
      amount: 200,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
    });
    expect(result.success).toBe(true);
  });

  test('templateLineUpdateSchema accepts savingsGoalId (incl. null to untag)', () => {
    expect(
      templateLineUpdateSchema.safeParse({ savingsGoalId: UUID }).success,
    ).toBe(true);
    expect(
      templateLineUpdateSchema.safeParse({ savingsGoalId: null }).success,
    ).toBe(true);
  });

  test('templateLineSchema (read) includes savingsGoalId', () => {
    const now = new Date().toISOString();
    const result = templateLineSchema.safeParse({
      id: UUID,
      templateId: UUID,
      savingsGoalId: null,
      name: 'Épargne',
      amount: 0,
      kind: 'saving',
      recurrence: 'fixed',
      description: '',
      createdAt: now,
      updatedAt: now,
    });
    expect(result.success).toBe(true);
  });
});
