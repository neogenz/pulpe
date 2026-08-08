import { describe, it, expect } from 'vitest';
import {
  buildSavingsGoalTimeline,
  simulateSavingsPlan,
  redistributeRemainingEffort,
  allocateMonthAmountToLines,
  type SavingsPlanTimelineMonth,
} from './savings-goal-plan.js';
import {
  computeSavingsGoalProgress,
  type LinkedSavingLine,
  type SavingsGoalProgressInput,
} from './savings-goal-progress.js';
import { MAX_SAVINGS_GOAL_PLAN_PERIODS } from '../../schemas.js';

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
    const missingBudget = buildSavingsGoalTimeline({
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
    const existingBudget = buildSavingsGoalTimeline({
      ...input,
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ],
      canProvisionMissingPeriods: false,
    });

    expect(missingBudget[3]).toMatchObject({
      month: 4,
      state: 'gap',
      hasBudget: false,
      isProvisionable: true,
    });
    expect(existingBudget[3]).toMatchObject({
      month: 4,
      state: 'gap',
      hasBudget: true,
      isProvisionable: true,
    });
  });

  it('should never provision a gap for an objective without a target date, whether or not its budget already exists', () => {
    const withBudget = buildSavingsGoalTimeline({
      ...input,
      targetDate: null,
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
    const withoutBudget = buildSavingsGoalTimeline({
      ...input,
      targetDate: null,
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ],
      canProvisionMissingPeriods: true,
    });

    expect(withBudget[3]).toMatchObject({
      month: 4,
      state: 'gap',
      hasBudget: true,
      isProvisionable: false,
    });
    expect(withoutBudget[3]).toMatchObject({
      month: 4,
      state: 'gap',
      hasBudget: false,
      isProvisionable: false,
    });
  });

  it('should not provision a gap after the target when a later linked line extends the timeline', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      targetDate: '2026-03-31',
      now: new Date(2026, 0, 15),
      lines: [savingLine({ month: 5, year: 2026 })],
      materializedPeriods: [{ month: 5, year: 2026 }],
      canProvisionMissingPeriods: true,
    });

    expect(timeline.find((month) => month.month === 4)).toMatchObject({
      state: 'gap',
      isProvisionable: false,
    });
  });

  it('should clamp invalid historical horizons to 120 periods', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      createdAt: '2000-01-01T00:00:00.000Z',
      targetDate: '9999-12-31',
      initialAmount: 750,
      lines: [],
    });

    expect(timeline).toHaveLength(120);
    expect(timeline[0].confirmedCumulative).toBe(750);
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

  it('should seed confirmedCumulative with initialAmount, leave plannedCumulative untouched, and keep the confirmed invariant', () => {
    const seeded: SavingsGoalProgressInput = { ...input, initialAmount: 500 };
    const baseline = buildSavingsGoalTimeline(input);
    const timeline = buildSavingsGoalTimeline(seeded);
    const progress = computeSavingsGoalProgress(seeded);

    timeline.forEach((month, index) => {
      expect(month.plannedCumulative).toBe(baseline[index].plannedCumulative);
      expect(month.confirmedCumulative).toBe(
        baseline[index].confirmedCumulative + 500,
      );
    });
    expect(timeline[timeline.length - 1].confirmedCumulative).toBe(
      progress.confirmed,
    );
  });

  it('seeds initialAmount before a future start even without future lines', () => {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      startDate: '2026-03-15',
      targetDate: null,
      initialAmount: 500,
      now: new Date(2026, 0, 15),
      lines: [],
      transactions: [],
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      month: 1,
      isContributionEligible: false,
      plannedCumulative: 0,
      confirmedCumulative: 500,
    });
  });

  it('should produce an identical timeline whether initialAmount is absent or 0', () => {
    const absent = buildSavingsGoalTimeline(input);
    const zero = buildSavingsGoalTimeline({ ...input, initialAmount: 0 });
    expect(zero).toEqual(absent);
  });

  it('should guarantee that a provisionable month is never locked, is contribution-eligible, and carries no linked line', () => {
    // Arrange — four real calculator runs. Each is chosen so that dropping
    // one of the three implied conjuncts from isProvisionable's definition
    // in buildSavingsGoalTimeline would make a wrong month provisionable:
    // missingBudget/existingBudget guard `!hasLines` (month 4 has no line,
    // month 3 does and must stay excluded), afterTarget guards
    // `isContributionEligible` (month 4 sits past the target), and lockedGap
    // guards `!isLocked` (March is a strictly-past gap). Asserting over
    // buildSavingsGoalTimeline's own output — not hand-built fixtures — is
    // what makes this catch a regression in the producer itself.
    const missingBudgetGap = buildSavingsGoalTimeline({
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
    const existingBudgetGap = buildSavingsGoalTimeline({
      ...input,
      materializedPeriods: [
        { month: 1, year: 2026 },
        { month: 2, year: 2026 },
        { month: 3, year: 2026 },
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ],
      canProvisionMissingPeriods: false,
    });
    const afterTargetGap = buildSavingsGoalTimeline({
      ...input,
      targetDate: '2026-03-31',
      now: new Date(2026, 0, 15),
      lines: [savingLine({ month: 5, year: 2026 })],
      materializedPeriods: [{ month: 5, year: 2026 }],
      canProvisionMissingPeriods: true,
    });
    const lockedGap = buildSavingsGoalTimeline({
      ...input,
      now: new Date(2026, 3, 15),
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
        savingLine({ month: 4, year: 2026 }),
        savingLine({ month: 5, year: 2026 }),
        savingLine({ month: 6, year: 2026 }),
      ],
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

    // Act
    const months = [
      ...missingBudgetGap,
      ...existingBudgetGap,
      ...afterTargetGap,
      ...lockedGap,
    ];
    const provisionable = months.filter(
      (month) => month.isProvisionable === true,
    );

    // Assert — the calculator did produce provisionable months to check,
    // and every one of them upholds all three implied guarantees.
    expect(provisionable.length).toBeGreaterThan(0);
    provisionable.forEach((month) => {
      expect(month.isLocked).toBe(false);
      expect(month.isContributionEligible).toBe(true);
      expect(month.lines).toHaveLength(0);
    });
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

  it('should never simulate an open month below its already confirmed amount', () => {
    const current = planMonth({
      month: 3,
      year: 2026,
      state: 'current',
      plannedAmount: 1_000,
      confirmedAmount: 1_200,
      lines: [
        {
          budgetLineId: 'checked',
          amount: 500,
          checkedAt: '2026-03-10T00:00:00Z',
          isManuallyAdjusted: false,
        },
        {
          budgetLineId: 'open',
          amount: 500,
          checkedAt: null,
          isManuallyAdjusted: false,
        },
      ],
    });

    const result = simulateSavingsPlan({
      timeline: [current],
      targetAmount: 2_000,
      globalMonthlyAmount: 800,
    });

    expect(result.months[0].simulatedAmount).toBe(800);
    expect(result.months[0].simulatedCumulative).toBe(1_200);
    expect(result.simulatedFinal).toBe(1_200);
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

  it('should treat a negative monthly adjustment as one plan-only withdrawal', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 9,
          year: 2026,
          state: 'current',
          plannedAmount: 1_260,
        }),
      ],
      targetAmount: 10_000,
      initialAmount: 10_000,
      adjustments: [{ month: 9, year: 2026, amount: -4_500 }],
    });

    expect(result.months[0].simulatedAmount).toBe(-4_500);
    expect(result.simulatedFinal).toBe(6_760);
  });

  it('should preserve the planned contribution when reloading a plan-only withdrawal', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 9,
          year: 2026,
          state: 'current',
          plannedAmount: 1_260,
          plannedWithdrawalAmount: 4_500,
          remainingPlannedWithdrawalAmount: 4_500,
          planOnlyWithdrawalAmount: 4_500,
        }),
      ],
      targetAmount: 10_000,
      initialAmount: 10_000,
    });

    expect(result.months[0].simulatedAmount).toBe(-4_500);
    expect(result.simulatedFinal).toBe(6_760);
  });

  it('should replace a reloaded plan-only withdrawal instead of subtracting it twice', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 9,
          year: 2026,
          state: 'current',
          plannedAmount: 1_260,
          plannedWithdrawalAmount: 4_500,
          remainingPlannedWithdrawalAmount: 4_500,
          planOnlyWithdrawalAmount: 4_500,
        }),
      ],
      targetAmount: 10_000,
      initialAmount: 10_000,
      adjustments: [{ month: 9, year: 2026, amount: -3_000 }],
    });

    expect(result.simulatedFinal).toBe(8_260);
  });

  it('should reload and replace a plan-managed linked income without double counting it', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 9,
          year: 2026,
          state: 'current',
          plannedAmount: 1_260,
          plannedWithdrawalAmount: 4_500,
          remainingPlannedWithdrawalAmount: 4_500,
          planLinkedWithdrawalAmount: 4_500,
        }),
      ],
      targetAmount: 10_000,
      initialAmount: 10_000,
      adjustments: [{ month: 9, year: 2026, amount: -3_000 }],
    });

    expect(result.months[0].simulatedAmount).toBe(-3_000);
    expect(result.simulatedFinal).toBe(8_260);
  });

  it('should replace a reloaded withdrawal with one positive contribution when explicitly cleared', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 9,
          year: 2026,
          state: 'current',
          plannedAmount: 500,
          plannedWithdrawalAmount: 4_500,
          remainingPlannedWithdrawalAmount: 4_500,
          planOnlyWithdrawalAmount: 4_500,
        }),
      ],
      targetAmount: 10_000,
      initialAmount: 10_000,
      adjustments: [
        {
          month: 9,
          year: 2026,
          amount: 1_260,
          replacesPlanOnlyWithdrawal: true,
        },
      ],
    });

    expect(result.months[0].simulatedAmount).toBe(1_260);
    expect(result.simulatedFinal).toBe(11_260);
  });

  it('should count a linked-income plan once when no plan-only twin exists', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 9,
          year: 2026,
          state: 'current',
          plannedAmount: 0,
          plannedWithdrawalAmount: 4_500,
          remainingPlannedWithdrawalAmount: 4_500,
        }),
      ],
      targetAmount: 10_000,
      initialAmount: 10_000,
    });

    expect(result.simulatedFinal).toBe(5_500);
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

  it('should seed simulatedCumulative with initialAmount and reach the target earlier', () => {
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      initialAmount: 2000,
    });

    expect(result.simulatedFinal).toBe(4000);
    expect(result.isTargetMet).toBe(true);
    expect(result.attainedPeriod).toEqual({ month: 2, year: 2026 });
  });

  it('should produce an identical simulation whether initialAmount is absent or 0', () => {
    const absent = simulateSavingsPlan({ timeline, targetAmount: 3000 });
    const zero = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      initialAmount: 0,
    });
    expect(zero).toEqual(absent);
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

  it('should replace a reloaded direct withdrawal when redistributing a signed pin', () => {
    const signedTimeline = [
      planMonth({
        month: 9,
        year: 2026,
        state: 'current',
        plannedAmount: 0,
        plannedWithdrawalAmount: 4_500,
        remainingPlannedWithdrawalAmount: 4_500,
        planOnlyWithdrawalAmount: 4_500,
      }),
      planMonth({ month: 10, year: 2026, state: 'future' }),
    ];
    const redistribution = redistributeRemainingEffort({
      timeline: signedTimeline,
      targetAmount: 12_000,
      initialAmount: 10_000,
      pinnedAdjustments: [{ month: 9, year: 2026, amount: -3_000 }],
    });
    const simulation = simulateSavingsPlan({
      timeline: signedTimeline,
      targetAmount: 12_000,
      initialAmount: 10_000,
      adjustments: [
        { month: 9, year: 2026, amount: -3_000 },
        ...redistribution.adjustments,
      ],
    });

    expect(redistribution.remainingEffort).toBe(5_000);
    expect(redistribution.adjustments).toEqual([
      { month: 10, year: 2026, amount: 5_000 },
    ]);
    expect(simulation.simulatedFinal).toBe(12_000);
  });

  it('should compensate an unpinned reloaded withdrawal during redistribution', () => {
    const timelineWithWithdrawal = [
      planMonth({
        month: 9,
        year: 2026,
        state: 'current',
        plannedAmount: 1_260,
        plannedWithdrawalAmount: 4_500,
        remainingPlannedWithdrawalAmount: 4_500,
        planOnlyWithdrawalAmount: 4_500,
      }),
      planMonth({ month: 10, year: 2026, state: 'future' }),
    ];
    const redistribution = redistributeRemainingEffort({
      timeline: timelineWithWithdrawal,
      targetAmount: 12_000,
      initialAmount: 10_000,
    });
    const simulation = simulateSavingsPlan({
      timeline: timelineWithWithdrawal,
      targetAmount: 12_000,
      initialAmount: 10_000,
      adjustments: redistribution.adjustments,
    });

    expect(redistribution.remainingEffort).toBe(6_500);
    expect(redistribution.adjustments).toEqual([
      { month: 9, year: 2026, amount: 3_250 },
      { month: 10, year: 2026, amount: 3_250 },
    ]);
    expect(simulation.simulatedFinal).toBe(12_000);
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

  it('should redistribute through an existing budget without a linked line', () => {
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

    expect(result.isDistributable).toBe(true);
    expect(result.adjustments).toEqual([
      { month: 1, year: 2026, amount: 1000 },
      { month: 2, year: 2026, amount: 1000 },
      { month: 3, year: 2026, amount: 1000 },
    ]);
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

  it('should deduct the initial stock before distributing the remaining effort', () => {
    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 10_000,
      initialAmount: 5_000,
    });

    expect(result.isDistributable).toBe(true);
    expect(result.remainingEffort).toBe(4_000);
    expect(result.adjustments).toEqual([
      { month: 3, year: 2026, amount: 2_000 },
      { month: 4, year: 2026, amount: 2_000 },
    ]);
  });

  it('should produce an identical redistribution whether initialAmount is absent or 0', () => {
    const absent = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });
    const zero = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
      initialAmount: 0,
    });
    expect(zero).toEqual(absent);
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

describe('PUL-314 — timeline and simulation over an optional interval', () => {
  it('ends an undated timeline at the last linked period without a 120-month cap', () => {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: null,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      targetDate: null,
      now: new Date(2026, 0, 15),
      lines: [savingLine({ month: 2, year: 2037 })],
      transactions: [],
    });

    expect(timeline.at(-1)).toMatchObject({ month: 2, year: 2037 });
    expect(timeline.length).toBeGreaterThan(120);
  });

  it('keeps pre-start rows but excludes them from contribution and redistribution', () => {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: 2000,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      startDate: '2026-02-15',
      targetDate: '2026-03-31',
      now: new Date(2026, 0, 15),
      lines: [
        savingLine({ month: 1, year: 2026 }),
        savingLine({ month: 2, year: 2026 }),
        savingLine({ month: 3, year: 2026 }),
      ],
      transactions: [],
    });

    expect(timeline[0]).toMatchObject({
      month: 1,
      isContributionEligible: false,
      plannedCumulative: 0,
    });

    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 2000,
    });
    expect(result.adjustments.map(({ month }) => month)).toEqual([2, 3]);
  });

  it('does not deduct a locked contribution that predates the historical anchor', () => {
    const timeline = buildSavingsGoalTimeline({
      targetAmount: 2000,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      startDate: '2026-02-15',
      targetDate: '2026-03-31',
      now: new Date(2026, 2, 15),
      lines: [
        savingLine({
          month: 1,
          year: 2026,
          checkedAt: '2026-01-20T00:00:00.000Z',
        }),
        savingLine({ month: 3, year: 2026 }),
      ],
      transactions: [],
    });

    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 2000,
    });

    expect(result.adjustments).toEqual([
      { month: 3, year: 2026, amount: 2000 },
    ]);

    const simulation = simulateSavingsPlan({
      timeline,
      targetAmount: 2000,
    });
    expect(simulation.simulatedFinal).toBe(500);
  });

  it('simulates monthly amounts without a target and returns null target verdicts', () => {
    const result = simulateSavingsPlan({
      timeline: [planMonth({ month: 6, year: 2026 })],
      targetAmount: null,
      globalMonthlyAmount: 750,
    });

    expect(result.simulatedFinal).toBe(750);
    expect(result.gapToTarget).toBeNull();
    expect(result.isTargetMet).toBeNull();
    expect(result.attainedPeriod).toBeNull();
  });

  it('disables redistribution when no target exists', () => {
    const result = redistributeRemainingEffort({
      timeline: [planMonth({ month: 6, year: 2026 })],
      targetAmount: null,
    });

    expect(result).toMatchObject({
      adjustments: [],
      remainingEffort: 0,
      perRemainingMonth: 0,
      isDistributable: false,
    });
  });
});

describe('buildSavingsGoalTimeline withdrawals (PUL-329)', () => {
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
    ],
    transactions: [],
    withdrawals: [{ amount: 400, month: 2, year: 2026 }],
  };

  it('should dip the confirmed cumulative on the withdrawal month', () => {
    const timeline = buildSavingsGoalTimeline(input);

    expect(timeline[0]).toMatchObject({ confirmedCumulative: 500 });
    expect(timeline[1]).toMatchObject({ confirmedCumulative: 600 });
  });

  it('should keep the withdrawal out of the month contribution amount', () => {
    const timeline = buildSavingsGoalTimeline(input);

    expect(timeline[1]).toMatchObject({
      confirmedAmount: 500,
      plannedAmount: 500,
      plannedCumulative: 1000,
    });
  });

  it('should match the confirmed stock of computeSavingsGoalProgress', () => {
    const timeline = buildSavingsGoalTimeline(input);
    const progress = computeSavingsGoalProgress(input);
    const currentMonth = timeline.find(
      (month) => month.month === 3 && month.year === 2026,
    );

    expect(currentMonth?.confirmedCumulative).toBe(progress.confirmed);
  });

  it('should not count a withdrawn month twice when simulating', () => {
    const timeline = buildSavingsGoalTimeline(input);
    const progress = computeSavingsGoalProgress(input);

    const result = simulateSavingsPlan({ timeline, targetAmount: 3000 });
    const lastLocked = result.months.find(
      (month) => month.month === 2 && month.year === 2026,
    );

    expect(lastLocked?.simulatedCumulative).toBe(progress.confirmed);
  });

  it('should ask for the effort the withdrawal actually reopened', () => {
    const timeline = buildSavingsGoalTimeline(input);
    const progress = computeSavingsGoalProgress(input);

    const result = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });

    expect(result.remainingEffort).toBe(3000 - progress.confirmed);
  });

  // Les deux tests ci-dessus portent leur retrait sur un mois VERROUILLÉ : une
  // somme des retraits filtrée sur `isLocked` y donnerait le même chiffre et
  // passerait au vert. Ici le retrait est sur un mois ouvert, et l'assertion est
  // la propriété de fermeture — redistribuer puis simuler doit retomber sur la
  // cible. Seule la somme sur tous les mois de la timeline y arrive.
  it('should close on the target when the withdrawal sits on an open month', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      withdrawals: [{ amount: 400, month: 3, year: 2026 }],
      materializedPeriods: [
        { month: 4, year: 2026 },
        { month: 5, year: 2026 },
        { month: 6, year: 2026 },
      ],
    });

    const redistribution = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      adjustments: redistribution.adjustments,
    });

    expect(redistribution.isDistributable).toBe(true);
    expect(redistribution.remainingEffort).toBe(2400);
    expect(result.simulatedFinal).toBe(3000);
  });

  // Soustraire en cours de boucle est la première chose qui puisse faire
  // DESCENDRE le cumul simulé : la cible peut être franchie puis reperdue.
  it('should drop the attained period when a later withdrawal reopens the gap', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 1,
          year: 2026,
          isLocked: true,
          confirmedAmount: 600,
        }),
        planMonth({
          month: 2,
          year: 2026,
          isLocked: true,
          confirmedAmount: 600,
        }),
        planMonth({
          month: 3,
          year: 2026,
          isLocked: true,
          confirmedAmount: 0,
          withdrawnAmount: 400,
        }),
      ],
      targetAmount: 1000,
    });

    expect(result.simulatedFinal).toBe(800);
    expect(result.isTargetMet).toBe(false);
    expect(result.attainedPeriod).toBeNull();
  });

  // Un objectif ouvert avec un stock de départ mais dont les contributions ne
  // démarrent que plus tard peut être ponctionné AVANT son ancre. Le retrait
  // tombe alors hors de l'intervalle historique, là où le cumul l'ignorait
  // tandis que `computeSavingsGoalProgress` le comptait : 5000 contre 4000.
  it('should count a withdrawal that lands before the contribution anchor', () => {
    const earlyWithdrawal: SavingsGoalProgressInput = {
      targetAmount: 8000,
      status: 'ACTIVE',
      createdAt: '2026-01-15T00:00:00.000Z',
      startDate: '2026-06-01',
      targetDate: '2026-12-31',
      payDayOfMonth: null,
      now: new Date(2026, 2, 15),
      initialAmount: 5000,
      lines: [],
      transactions: [],
      withdrawals: [{ amount: 1000, month: 2, year: 2026 }],
    };

    const timeline = buildSavingsGoalTimeline(earlyWithdrawal);
    const progress = computeSavingsGoalProgress(earlyWithdrawal);

    expect(progress.confirmed).toBe(4000);
    expect(timeline[timeline.length - 1]?.confirmedCumulative).toBe(
      progress.confirmed,
    );
  });

  // Le simulateur filtrait sur `isContributionEligible`, plus étroit que
  // l'intervalle historique de la timeline : un retrait postérieur à l'échéance
  // était compté par l'une et ignoré par l'autre.
  it('should count a withdrawal on a month closed to contributions', () => {
    const result = simulateSavingsPlan({
      timeline: [
        planMonth({
          month: 1,
          year: 2026,
          isLocked: true,
          confirmedAmount: 1000,
        }),
        planMonth({
          month: 2,
          year: 2026,
          isContributionEligible: false,
          plannedAmount: 0,
          withdrawnAmount: 300,
        }),
      ],
      targetAmount: 1000,
    });

    expect(result.simulatedFinal).toBe(700);
    expect(result.isTargetMet).toBe(false);
  });

  // La fermeture doit tenir même quand le retrait sort de la fenêtre : les deux
  // sommes de retraits, celle que soustrait la simulation et celle que rajoute
  // la redistribution, doivent porter sur le même ensemble.
  it('should still close on the target when the withdrawal sits outside the window', () => {
    const timeline = [
      planMonth({ month: 1, year: 2026, isLocked: true, confirmedAmount: 600 }),
      planMonth({
        month: 2,
        year: 2026,
        isContributionEligible: false,
        plannedAmount: 0,
        withdrawnAmount: 400,
      }),
      planMonth({ month: 3, year: 2026 }),
      planMonth({ month: 4, year: 2026 }),
    ];

    const redistribution = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      adjustments: redistribution.adjustments,
    });

    expect(redistribution.remainingEffort).toBe(2800);
    expect(result.simulatedFinal).toBe(3000);
  });

  it('should give a withdrawal-only month its own row', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      targetDate: null,
      withdrawals: [{ amount: 400, month: 9, year: 2026 }],
    });

    expect(timeline.at(-1)).toMatchObject({ month: 9, year: 2026 });
  });

  // Une échéance à l'horizon maximal sature la fenêtre : `startIndex` remonte
  // jusqu'au mois courant et le retrait de janvier n'a plus de row où creuser
  // le cumul. `computeSavingsGoalProgress` le retranche quand même, donc les
  // deux surfaces affichent deux soldes différents pour le même objectif.
  // L'échéance ci-dessous est acceptée par `savingsGoalCreateSchema`, qui
  // borne l'horizon à `MAX_SAVINGS_GOAL_PLAN_PERIODS` — c'est exactement la
  // borne qui rend le cas atteignable, pas une entrée que le serveur refuse.
  it('should keep a withdrawal pushed out of the plan window in the stock', () => {
    const farTargetInput: SavingsGoalProgressInput = {
      ...input,
      targetAmount: 100000,
      createdAt: '2026-01-15T00:00:00.000Z',
      targetDate: '2036-02-28',
      lines: [],
      initialAmount: 5000,
      withdrawals: [{ amount: 1000, month: 1, year: 2026 }],
    };

    const timeline = buildSavingsGoalTimeline(farTargetInput);
    const progress = computeSavingsGoalProgress(farTargetInput);

    expect(timeline).toHaveLength(MAX_SAVINGS_GOAL_PLAN_PERIODS);
    expect(timeline[0]).toMatchObject({ month: 3, year: 2026 });
    expect(progress.confirmed).toBe(4000);
    expect(timeline.at(-1)?.confirmedCumulative).toBe(progress.confirmed);
  });

  // Le simulateur et la redistribution tournent chez le client sur `months[]` :
  // ils ne voient du stock que `initialAmount` et les retraits portés par les
  // rows. Corriger le seul cumul de la timeline les aurait laissés surestimer
  // le stock du montant éjecté — ils annonceraient une cible atteinte et un
  // effort restant trop faible, tous les deux de 1000 exactement.
  it('should not let a withdrawal outside the window inflate the simulation', () => {
    const farTargetInput: SavingsGoalProgressInput = {
      ...input,
      targetAmount: 100000,
      createdAt: '2026-01-15T00:00:00.000Z',
      targetDate: '2036-02-28',
      lines: [],
      initialAmount: 5000,
      withdrawals: [{ amount: 1000, month: 1, year: 2026 }],
    };

    const timeline = buildSavingsGoalTimeline(farTargetInput);
    const progress = computeSavingsGoalProgress(farTargetInput);
    const simulation = simulateSavingsPlan({
      timeline,
      targetAmount: 100000,
      initialAmount: 5000,
    });
    const redistribution = redistributeRemainingEffort({
      timeline,
      targetAmount: 100000,
      initialAmount: 5000,
    });

    expect(simulation.simulatedFinal).toBe(progress.confirmed);
    expect(redistribution.remainingEffort).toBe(100000 - progress.confirmed);
  });
});

describe('buildSavingsGoalTimeline planned withdrawals (PUL-329 v2)', () => {
  const PLAN_ID = 'plan-may';

  /**
   * Objectif 3'000, janvier → juin 2026, « maintenant » = mars. 500 confirmés
   * en janvier et février, 500 encore prévus chaque mois de mars à juin, et un
   * retrait de 500 annoncé pour mai.
   */
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
      savingLine({ month: 4, year: 2026 }),
      savingLine({ month: 5, year: 2026 }),
      savingLine({ month: 6, year: 2026 }),
    ],
    transactions: [],
    plannedWithdrawals: [{ id: PLAN_ID, amount: 500, month: 5, year: 2026 }],
  };

  const monthOf = (
    timeline: SavingsPlanTimelineMonth[],
    month: number,
  ): SavingsPlanTimelineMonth | undefined =>
    timeline.find((row) => row.month === month && row.year === 2026);

  it('should show the announced amount and its untouched remainder', () => {
    const timeline = buildSavingsGoalTimeline(input);

    expect(monthOf(timeline, 5)).toMatchObject({
      plannedWithdrawalAmount: 500,
      remainingPlannedWithdrawalAmount: 500,
      confirmedAmount: 0,
    });
  });

  it('should keep the announcement out of the confirmed cumulative', () => {
    const timeline = buildSavingsGoalTimeline(input);
    const progress = computeSavingsGoalProgress(input);

    expect(monthOf(timeline, 6)?.confirmedCumulative).toBe(progress.confirmed);
  });

  it('should land the projected cumulative on the projection of the progress', () => {
    const timeline = buildSavingsGoalTimeline(input);
    const progress = computeSavingsGoalProgress(input);

    expect(monthOf(timeline, 6)?.projectedCumulative).toBe(progress.projected);
  });

  it('should leave only the unrealized part in the remainder', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      withdrawals: [
        { amount: 300, month: 5, year: 2026, budgetLineId: PLAN_ID },
      ],
    });

    expect(monthOf(timeline, 5)).toMatchObject({
      plannedWithdrawalAmount: 500,
      remainingPlannedWithdrawalAmount: 200,
      withdrawnAmount: 300,
    });
  });

  it('should lapse a plan the user let pass', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      plannedWithdrawals: [{ id: PLAN_ID, amount: 500, month: 1, year: 2026 }],
    });

    expect(monthOf(timeline, 1)).toMatchObject({
      plannedWithdrawalAmount: 500,
      remainingPlannedWithdrawalAmount: 0,
    });
  });

  it('should ignore a plan announced beyond the deadline', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      plannedWithdrawals: [{ id: PLAN_ID, amount: 500, month: 8, year: 2026 }],
    });

    expect(monthOf(timeline, 8)).toMatchObject({
      plannedWithdrawalAmount: 500,
      remainingPlannedWithdrawalAmount: 0,
    });
  });

  // La propriété de fermeture : redistribuer puis simuler doit retomber sur la
  // cible au centime près. Elle ne tient que si le simulateur soustrait
  // exactement l'ensemble que la redistribution rajoute à l'effort.
  it('should close on the target after redistributing around the announcement', () => {
    const timeline = buildSavingsGoalTimeline(input);

    const redistribution = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      adjustments: redistribution.adjustments,
    });

    expect(redistribution.isDistributable).toBe(true);
    expect(redistribution.remainingEffort).toBe(2500);
    expect(sumCents(result.simulatedFinal)).toBe(sumCents(3000));
  });

  it('should close on the target once the announcement is realized', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      withdrawals: [
        { amount: 500, month: 5, year: 2026, budgetLineId: PLAN_ID },
      ],
    });

    const redistribution = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      adjustments: redistribution.adjustments,
    });

    expect(redistribution.remainingEffort).toBe(2500);
    expect(sumCents(result.simulatedFinal)).toBe(sumCents(3000));
  });

  // Un réel supérieur au prévu n'engendre pas de reliquat négatif, et un retrait
  // libre du même plan reste compté à part. Les deux doivent entrer une seule
  // fois dans l'effort restant comme dans le cumul simulé.
  it('should close on the target with an over-realized plan next to a free withdrawal', () => {
    const timeline = buildSavingsGoalTimeline({
      ...input,
      withdrawals: [
        { amount: 600, month: 5, year: 2026, budgetLineId: PLAN_ID },
        { amount: 200, month: 4, year: 2026 },
      ],
    });

    expect(monthOf(timeline, 5)).toMatchObject({
      plannedWithdrawalAmount: 500,
      remainingPlannedWithdrawalAmount: 0,
      withdrawnAmount: 600,
    });

    const redistribution = redistributeRemainingEffort({
      timeline,
      targetAmount: 3000,
    });
    const result = simulateSavingsPlan({
      timeline,
      targetAmount: 3000,
      adjustments: redistribution.adjustments,
    });

    expect(redistribution.remainingEffort).toBe(2800);
    expect(sumCents(result.simulatedFinal)).toBe(sumCents(3000));
  });

  // Une échéance à l'horizon maximal sature la fenêtre : un retrait RÉEL
  // antérieur est reporté sur la première row, une prévision antérieure est
  // échue et disparaît — elle n'a pas eu lieu et n'aura pas lieu.
  it('should carry only the real withdrawal across the window edge', () => {
    const farInput: SavingsGoalProgressInput = {
      ...input,
      targetAmount: 100000,
      targetDate: '2036-02-28',
      lines: [],
      initialAmount: 5000,
      withdrawals: [{ amount: 1000, month: 1, year: 2026 }],
      plannedWithdrawals: [{ id: PLAN_ID, amount: 700, month: 1, year: 2026 }],
    };

    const timeline = buildSavingsGoalTimeline(farInput);
    const progress = computeSavingsGoalProgress(farInput);
    const simulation = simulateSavingsPlan({
      timeline,
      targetAmount: 100000,
      initialAmount: 5000,
    });

    expect(timeline).toHaveLength(MAX_SAVINGS_GOAL_PLAN_PERIODS);
    expect(timeline[0]?.withdrawnAmount).toBe(1000);
    expect(simulation.simulatedFinal).toBe(progress.confirmed);
  });
});
