import { describe, it, expect } from 'vitest';
import {
  buildSavingsGoalTimeline,
  simulateSavingsPlan,
  redistributeRemainingEffort,
  allocateMonthAmountToLines,
  type SavingsPlanTimelineMonth,
} from './savings-goal-plan.js';
import type {
  LinkedSavingLine,
  SavingsGoalProgressInput,
} from './savings-goal-progress.js';

const savingLine = (
  overrides: Partial<LinkedSavingLine> & {
    month: number;
    year: number;
  },
): LinkedSavingLine => ({
  id: `${overrides.year}-${overrides.month}`,
  amount: 500,
  kind: 'saving',
  checkedAt: null,
  ...overrides,
});

const planMonth = (
  overrides: Partial<SavingsPlanTimelineMonth> & {
    month: number;
    year: number;
  },
): SavingsPlanTimelineMonth => ({
  state: 'future',
  isLocked: false,
  isProvisionable: false,
  plannedAmount: 500,
  confirmedAmount: 0,
  plannedCumulative: 0,
  confirmedCumulative: 0,
  lines: [
    {
      budgetLineId: `${overrides.year}-${overrides.month}`,
      amount: overrides.plannedAmount ?? 500,
      checkedAt: null,
      isManuallyAdjusted: false,
    },
  ],
  ...overrides,
});

const sumCents = (amount: number): number => Math.round(amount * 100);

describe('buildSavingsGoalTimeline', () => {
  const input: SavingsGoalProgressInput = {
    targetAmount: 3000,
    status: 'ACTIVE',
    createdAt: '2026-01-15T00:00:00.000Z',
    targetDate: '2026-06-30',
    payDayOfMonth: null,
    now: new Date(2026, 2, 15),
    lines: [
      savingLine({
        month: 1,
        year: 2026,
        checkedAt: '2026-01-20T00:00:00.000Z',
      }),
      savingLine({
        month: 2,
        year: 2026,
        checkedAt: '2026-02-20T00:00:00.000Z',
      }),
      savingLine({ month: 3, year: 2026 }),
      savingLine({ month: 5, year: 2026 }),
      savingLine({ month: 6, year: 2026 }),
    ],
    transactions: [],
  };

  it('should span anchor to target inclusive with a row per period', () => {
    const timeline = buildSavingsGoalTimeline(input);

    expect(timeline).toHaveLength(6);
    expect(timeline[0]).toMatchObject({ month: 1, year: 2026 });
    expect(timeline[5]).toMatchObject({ month: 6, year: 2026 });
  });

  it('should mark the current month and lock strictly-past months', () => {
    const timeline = buildSavingsGoalTimeline(input);

    expect(timeline[0]).toMatchObject({ state: 'past', isLocked: true });
    expect(timeline[2]).toMatchObject({ state: 'current', isLocked: false });
    expect(timeline[4]).toMatchObject({ state: 'future', isLocked: false });
  });

  it('should render months without a linked line as gap', () => {
    const timeline = buildSavingsGoalTimeline(input);

    const april = timeline[3];
    expect(april).toMatchObject({ month: 4, state: 'gap', plannedAmount: 0 });
    expect(april.lines).toHaveLength(0);
  });

  it('should distinguish a missing budget from an existing budget without a linked line', () => {
    const provisionable = buildSavingsGoalTimeline({
      ...input,
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ],
      canProvisionMissingPeriods: true,
    });
    const unavailable = buildSavingsGoalTimeline({
      ...input,
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ],
      canProvisionMissingPeriods: true,
    });

    expect(provisionable[3]).toMatchObject({
      month: 4,
      state: 'gap',
      isProvisionable: true,
    });
    expect(unavailable[3]).toMatchObject({
      month: 4,
      state: 'gap',
      isProvisionable: false,
    });
  });

  it('should clamp invalid historical horizons to 120 periods', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      createdAt: '2000-01-01T00:00:00.000Z',
      targetDate: '9999-12-31',
      lines: [],
    });

    expect(timeline).toHaveLength(120);
    expect(
      timeline.some((month) => month.month === 3 && month.year === 2026),
    ).toBe(true);
  });

  it('should keep cumulatives consistent with the progress totals', () => {
    const timeline = buildSavingsGoalTimeline(input);

    const currentMonth = timeline[2];
    expect(currentMonth.plannedCumulative).toBe(1500);
    expect(timeline[5].confirmedCumulative).toBe(1000);
  });
});

describe('simulateSavingsPlan', () => {
  const timeline: SavingsPlanTimelineMonth[] = [
    planMonth({
      month: 1,
      year: 2026,
      state: 'past',
      isLocked: true,
      confirmedAmount: 500,
    }),
    planMonth({
      month: 2,
      year: 2026,
      state: 'past',
      isLocked: true,
      confirmedAmount: 500,
    }),
    planMonth({ month: 3, year: 2026, state: 'current' }),
    planMonth({ month: 4, year: 2026, state: 'future' }),
  ];

  it('should keep reality on locked months and plan on open months', () => {
    const result = simulateSavingsPlan({ timeline, targetAmount: 3000 });

    expect(result.simulatedFinal).toBe(2000);
    expect(result.gapToTarget).toBe(1000);
    expect(result.isTargetMet).toBe(false);
    expect(result.attainedPeriod).toBeNull();
  });

  it('should apply a global monthly amount to every open month', () => {
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      globalMonthlyAmount: 1000,
    });

    expect(result.simulatedFinal).toBe(3000);
    expect(result.isTargetMet).toBe(true);
    expect(result.attainedPeriod).toEqual({ month: 4, year: 2026 });
  });

  it('should apply a global monthly amount to a provisionable gap', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({ month: 3, year: 2026, state: 'current' }),
        planMonth({
          month: 4,
          year: 2026,
          state: 'gap',
          plannedAmount: 0,
          lines: [],
          isProvisionable: true,
        }),
      ],
      targetAmount: 2000,
      globalMonthlyAmount: 1000,
    });

    expect(result.months.map((month) => month.simulatedAmount)).toEqual([
      1000, 1000,
    ]);
  });

  it('should throw when an adjustment targets a locked month', () => {
    expect(() =>
      simulateSavingsPlan({
        timeline,
        targetAmount: 3000,
        adjustments: [{ month: 1, year: 2026, amount: 800 }],
      }),
    ).toThrow();
  });
});

describe('redistributeRemainingEffort', () => {
  const timeline: SavingsPlanTimelineMonth[] = [
    planMonth({
      month: 1,
      year: 2026,
      state: 'past',
      isLocked: true,
      confirmedAmount: 500,
    }),
    planMonth({
      month: 2,
      year: 2026,
      state: 'past',
      isLocked: true,
      confirmedAmount: 500,
    }),
    planMonth({ month: 3, year: 2026, state: 'current' }),
    planMonth({ month: 4, year: 2026, state: 'future' }),
  ];

  it('should split the remaining effort over open months cents-exact', () => {
    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });

    expect(result.isDistributable).toBe(true);
    expect(result.remainingEffort).toBe(2000);
    expect(result.adjustments).toEqual([
      { month: 3, year: 2026, amount: 1000 },
      { month: 4, year: 2026, amount: 1000 },
    ]);
  });

  it('should hold pinned months fixed and distribute the rest', () => {
    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
      pinnedAdjustments: [{ month: 3, year: 2026, amount: 700 }],
    });

    expect(result.adjustments).toEqual([
      { month: 4, year: 2026, amount: 1300 },
    ]);
  });

  it('should distribute over all 24 periods when only two budgets exist', () => {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: 24_000,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      targetDate: '2027-12-31',
      now: new Date(2026, 0, 15),
      lines: [
        savingLine({ month: 1, year: 2026, amount: 0 }),
        savingLine({ month: 2, year: 2026, amount: 0 }),
      ],
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
      ],
      canProvisionMissingPeriods: true,
      transactions: [],
    });

    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 24_000,
    });

    expect(result.isDistributable).toBe(true);
    expect(result.adjustments).toHaveLength(24);
    expect(result.perRemainingMonth).toBe(1000);
    expect(result.adjustments.reduce((sum, item) => sum + item.amount, 0)).toBe(
      24_000,
    );
  });

  it('should block redistribution when an existing budget has no linked line', () => {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: 3000,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      targetDate: '2026-03-31',
      now: new Date(2026, 0, 15),
      lines: [savingLine({ month: 1, year: 2026 })],
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
      ],
      canProvisionMissingPeriods: true,
      transactions: [],
    });

    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });

    expect(result.isDistributable).toBe(false);
    expect(result.adjustments).toEqual([]);
  });

  it('should not be distributable when no open month remains', () => {
    const overdue: SavingsPlanTimelineMonth[] = [
      planMonth({
        month: 1,
        year: 2026,
        state: 'past',
        isLocked: true,
        confirmedAmount: 500,
      }),
    ];

    const result = redistributeRemainingEffort({
      timeline: overdue,
      targetAmount: 3000,
    });

    expect(result.isDistributable).toBe(false);
    expect(result.adjustments).toEqual([]);
  });

  it('should propose zeros when the target is already covered', () => {
    const result = redistributeRemainingEffort({ timeline, targetAmount: 800 });

    expect(result.adjustments).toEqual([
      { month: 3, year: 2026, amount: 0 },
      { month: 4, year: 2026, amount: 0 },
    ]);
  });
});

describe('allocateMonthAmountToLines', () => {
  it('should split proportionally to the current line amounts', () => {
    const result = allocateMonthAmountToLines(
      [
        { budgetLineId: 'a', amount: 300, checkedAt: null },
        { budgetLineId: 'b', amount: 100, checkedAt: null },
      ],
      500,
    );

    expect(result).toEqual([
      { budgetLineId: 'a', amount: 375 },
      { budgetLineId: 'b', amount: 125 },
    ]);
  });

  it('should preserve the requested month total when checked lines are untouched', () => {
    const result = allocateMonthAmountToLines(
      [
        {
          budgetLineId: 'a',
          amount: 300,
          checkedAt: '2026-01-01T00:00:00.000Z',
        },
        { budgetLineId: 'b', amount: 100, checkedAt: null },
      ],
      500,
    );

    expect(result).toEqual([{ budgetLineId: 'b', amount: 200 }]);
  });

  it('should split equally when current amounts sum to zero', () => {
    const result = allocateMonthAmountToLines(
      [
        { budgetLineId: 'a', amount: 0, checkedAt: null },
        { budgetLineId: 'b', amount: 0, checkedAt: null },
      ],
      500,
    );

    expect(result).toEqual([
      { budgetLineId: 'a', amount: 250 },
      { budgetLineId: 'b', amount: 250 },
    ]);
  });

  it('should zero every open line when the month amount is zero', () => {
    const result = allocateMonthAmountToLines(
      [
        { budgetLineId: 'a', amount: 300, checkedAt: null },
        { budgetLineId: 'b', amount: 100, checkedAt: null },
      ],
      0,
    );

    expect(result).toEqual([
      { budgetLineId: 'a', amount: 0 },
      { budgetLineId: 'b', amount: 0 },
    ]);
  });

  it('should preserve the total to the cent under rounding', () => {
    const result = allocateMonthAmountToLines(
      [
        { budgetLineId: 'a', amount: 100, checkedAt: null },
        { budgetLineId: 'b', amount: 100, checkedAt: null },
        { budgetLineId: 'c', amount: 100, checkedAt: null },
      ],
      100,
    );

    const total = result.reduce((sum, line) => sum + sumCents(line.amount), 0);
    expect(total).toBe(10000);
  });
});
