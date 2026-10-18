import { describe, it, expect } from 'vitest';
import type {
  SavingsGoalContribution,
  SavingsGoalPlanMonth,
  SavingsGoalPlannedWithdrawal,
  SavingsGoalWithdrawal,
  SavingsPlanSimulatedMonth,
  Transaction,
} from 'pulpe-shared';
import {
  buildGoalMonthTimeline,
  type GoalMonthEntry,
  type GoalMonthTimelineInput,
  type GoalWithdrawalEntry,
  windowGoalTimeline,
} from './goal-month-timeline.view-model';

const LINE_ID = '11111111-1111-4111-8111-111111111111';
const BUDGET_ID = '00000000-0000-4000-8000-000000000100';

function makeMonth(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 3,
    year: 2026,
    state: 'future',
    isLocked: false,
    plannedAmount: 450,
    confirmedAmount: 0,
    plannedCumulative: 450,
    confirmedCumulative: 0,
    lines: [
      {
        budgetLineId: LINE_ID,
        amount: 450,
        checkedAt: null,
        isManuallyAdjusted: false,
      },
    ],
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<GoalMonthTimelineInput> = {},
): GoalMonthTimelineInput {
  return {
    months: [],
    simulatedMonths: null,
    contributions: [],
    plannedWithdrawals: [],
    planOnlyWithdrawals: [],
    withdrawals: [],
    isWithdrawalsLoading: false,
    canRepair: true,
    payDayOfMonth: null,
    ...overrides,
  };
}

function makeTransaction(amount: number): Transaction {
  return {
    id: crypto.randomUUID(),
    budgetId: BUDGET_ID,
    budgetLineId: LINE_ID,
    name: 'Versement',
    amount,
    kind: 'saving',
    transactionDate: '2026-03-10T10:00:00.000Z',
    createdAt: '2026-03-10T10:00:00.000Z',
    updatedAt: '2026-03-10T10:00:00.000Z',
    checkedAt: null,
  } as Transaction;
}

function makeContribution(
  transactions: Transaction[],
  month = 3,
): SavingsGoalContribution {
  return {
    lineId: crypto.randomUUID(),
    name: 'Épargne',
    amount: 450,
    checkedAt: null,
    budgetMonth: month,
    budgetYear: 2026,
    transactions,
  };
}

function makePlanned(
  overrides: Partial<SavingsGoalPlannedWithdrawal> = {},
): SavingsGoalPlannedWithdrawal {
  return {
    budgetLineId: '00000000-0000-4000-8000-000000000301',
    budgetId: BUDGET_ID,
    name: 'Apport cuisine',
    month: 3,
    year: 2026,
    plannedAmount: 500,
    realizedAmount: 0,
    remainingAmount: 500,
    status: 'planned',
    ...overrides,
  };
}

function makeRealized(
  overrides: Partial<SavingsGoalWithdrawal> = {},
): SavingsGoalWithdrawal {
  return {
    transactionId: crypto.randomUUID(),
    budgetId: BUDGET_ID,
    name: 'Réparation toit',
    transactionDate: '2026-03-20T10:00:00.000Z',
    amount: 300,
    ...overrides,
  };
}

const months = (entries: readonly { kind: string }[]) =>
  entries.filter((e): e is GoalMonthEntry => e.kind === 'month');
const withdrawals = (entries: readonly { kind: string }[]) =>
  entries.filter((e): e is GoalWithdrawalEntry => e.kind === 'withdrawal');

describe('buildGoalMonthTimeline', () => {
  it('should quote a month before its withdrawals, each withdrawal stepping the balance down to the projection', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [makeMonth({ projectedCumulative: 3100 })],
        plannedWithdrawals: [makePlanned({ remainingAmount: 500 })],
      }),
    );

    expect(entries.map((e) => e.kind)).toEqual(['month', 'withdrawal']);
    expect(months(entries)[0].balance).toBe(3600);
    expect(withdrawals(entries)[0].balance).toBe(3100);
  });

  it('should fall back to the planned cumulative on a payload without a projection', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({ months: [makeMonth({ plannedCumulative: 3600 })] }),
    );

    expect(months(entries)[0].balance).toBe(3600);
  });

  it('should fold the real income of a linked forecast into that forecast instead of listing it twice', () => {
    const planned = makePlanned({
      realizedAmount: 300,
      remainingAmount: 200,
      status: 'partially_realized',
    });
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [makeMonth({ projectedCumulative: 1000 })],
        plannedWithdrawals: [planned],
        withdrawals: [makeRealized({ budgetLineId: planned.budgetLineId })],
      }),
    );

    const rows = withdrawals(entries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source: 'linked', realized: 300 });
    expect(months(entries)[0].balance).toBe(1500);
    expect(rows[0].balance).toBe(1000);
  });

  it('should list a free withdrawal at the period of its date', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [makeMonth({ month: 3 }), makeMonth({ month: 4 })],
        withdrawals: [
          makeRealized({ transactionDate: '2026-03-20T10:00:00Z' }),
        ],
      }),
    );

    expect(entries.map((e) => `${e.kind}-${e.periodKey % 12}`)).toEqual([
      'month-3',
      'withdrawal-3',
      'month-4',
    ]);
  });

  it('should keep a withdrawal no plan month carries, naming its own period without a balance', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({ withdrawals: [makeRealized()] }),
    );

    expect(withdrawals(entries)[0]).toMatchObject({
      showPeriod: true,
      balance: null,
    });
  });

  it('should let the withdrawal rows replace the month that only exists for its withdrawal', () => {
    const closed = makeMonth({
      month: 8,
      isContributionEligible: false,
      plannedAmount: 0,
      withdrawnAmount: 300,
      lines: [],
    });

    const withRows = buildGoalMonthTimeline(
      makeInput({
        months: [closed],
        withdrawals: [
          makeRealized({ transactionDate: '2026-08-10T10:00:00Z' }),
        ],
      }),
    );
    expect(months(withRows.entries)).toHaveLength(0);
    expect(withdrawals(withRows.entries)[0].showPeriod).toBe(true);

    const withoutRows = buildGoalMonthTimeline(makeInput({ months: [closed] }));
    expect(months(withoutRows.entries)[0]).toMatchObject({
      status: 'withdrawnSoFar',
      amount: null,
      withdrawn: 300,
    });
  });

  it('should drop a closed month that carries no withdrawal', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [
          makeMonth({
            month: 7,
            isContributionEligible: false,
            plannedAmount: 0,
            lines: [],
          }),
          makeMonth({ month: 9 }),
        ],
      }),
    );

    expect(entries.map((e) => e.periodKey)).toEqual([2026 * 12 + 9]);
  });

  it('should sum the real contributions of the month and keep them for the nested list', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [makeMonth()],
        contributions: [
          makeContribution([makeTransaction(200), makeTransaction(59.5)]),
          makeContribution([makeTransaction(100)], 4),
        ],
      }),
    );

    expect(months(entries)[0].realAmount).toBe(259.5);
    expect(months(entries)[0].transactions).toHaveLength(2);
  });

  it('should count a checked forecast for at least its planned amount', () => {
    const checkedAt = '2026-03-20T10:00:00.000Z';
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [makeMonth()],
        contributions: [
          { ...makeContribution([]), checkedAt },
          { ...makeContribution([makeTransaction(500)]), checkedAt },
          makeContribution([]),
        ],
      }),
    );

    expect(months(entries)[0].realAmount).toBe(450 + 500);
  });

  it('should tell checked, to-check and upcoming months apart', () => {
    const checkedLine = {
      budgetLineId: LINE_ID,
      amount: 450,
      checkedAt: '2026-03-15T10:00:00.000Z',
      isManuallyAdjusted: false,
    };
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [
          makeMonth({ month: 2, state: 'past', lines: [checkedLine] }),
          makeMonth({ month: 3, state: 'current' }),
          makeMonth({ month: 4 }),
          makeMonth({ month: 5 }),
        ],
        contributions: [makeContribution([makeTransaction(100)], 5)],
      }),
    );

    expect(months(entries).map((m) => m.status)).toEqual([
      'checked',
      'toCheck',
      'upcoming',
      'toCheck',
    ]);
    expect(months(entries).map((m) => m.isPast)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('should distinguish repairable, non-actionable and missing-budget months and count gaps plan-wide', () => {
    const empty = { plannedAmount: 0, lines: [] };
    const { entries, gapCount } = buildGoalMonthTimeline(
      makeInput({
        months: [
          makeMonth({
            month: 3,
            hasBudget: true,
            isProvisionable: true,
            ...empty,
          }),
          makeMonth({
            month: 4,
            hasBudget: true,
            isProvisionable: false,
            ...empty,
          }),
          makeMonth({ month: 5, hasBudget: false, ...empty }),
          makeMonth({ month: 6, state: 'current', hasBudget: false, ...empty }),
        ],
      }),
    );

    expect(months(entries).map((m) => m.status)).toEqual([
      'repair',
      'noForecast',
      'gap',
      'gap',
    ]);
    expect(months(entries)[0].amount).toBeNull();
    expect(gapCount).toBe(2);
  });

  it('should not offer repair when the plan has nothing to repair', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        canRepair: false,
        months: [
          makeMonth({
            hasBudget: true,
            isProvisionable: true,
            plannedAmount: 0,
            lines: [],
          }),
        ],
      }),
    );

    expect(months(entries)[0].status).toBe('noForecast');
  });

  it('should lock a month whose plan withdrawal is already realized and point to its budget', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [
          makeMonth({
            plannedWithdrawalAmount: 500,
            planLinkedWithdrawalAmount: 200,
            planWithdrawalDestination: 'linked_income',
            planWithdrawalConsumedAmount: 300,
          }),
        ],
        plannedWithdrawals: [
          makePlanned({ budgetId: 'manual-budget' }),
          makePlanned({
            budgetLineId: '00000000-0000-4000-8000-000000000302',
            budgetId: 'plan-budget',
            origin: 'plan_linked',
          }),
        ],
      }),
    );

    expect(months(entries)[0]).toMatchObject({
      blockedByRealization: true,
      isLocked: true,
      isOpen: false,
      withdrawalBudgetId: 'plan-budget',
    });
  });

  it('should follow the sandbox and hide withdrawals and réel while simulating', () => {
    const month = makeMonth({ projectedCumulative: 3100 });
    const simulated = {
      ...month,
      simulatedAmount: 600,
      simulatedCumulative: 2000,
      isAdjusted: true,
    } as SavingsPlanSimulatedMonth;
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [month],
        simulatedMonths: [simulated],
        plannedWithdrawals: [makePlanned()],
        contributions: [makeContribution([makeTransaction(100)])],
      }),
    );

    expect(entries).toHaveLength(1);
    expect(months(entries)[0]).toMatchObject({
      amount: 600,
      balance: 2000,
      isAdjusted: true,
      realAmount: null,
    });
  });

  it('should hold the place of loading withdrawals under the months that carry one', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        isWithdrawalsLoading: true,
        months: [
          makeMonth({ month: 3, plannedWithdrawalAmount: 500 }),
          makeMonth({ month: 4 }),
        ],
      }),
    );

    expect(entries.map((e) => e.kind)).toEqual(['month', 'skeleton', 'month']);
    expect(months(entries).map((m) => m.isBalancePending)).toEqual([
      true,
      false,
    ]);
  });

  it('should show a single placeholder when only withdrawals are loading', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({ isWithdrawalsLoading: true }),
    );

    expect(entries.map((e) => e.kind)).toEqual(['skeleton']);
  });
});

describe('windowGoalTimeline', () => {
  it('should window to the last locked month + 3 open months, withdrawals included', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [1, 2, 3, 4, 5, 6].map((month) =>
          makeMonth({ month, isLocked: month <= 2 }),
        ),
        withdrawals: [
          makeRealized({ transactionDate: '2026-01-10T10:00:00Z' }),
          makeRealized({ transactionDate: '2026-05-10T10:00:00Z' }),
        ],
      }),
    );

    const visible = windowGoalTimeline(entries, false);
    expect(visible.map((e) => `${e.kind}-${e.periodKey % 12}`)).toEqual([
      'month-2',
      'month-3',
      'month-4',
      'month-5',
      'withdrawal-5',
    ]);
    expect(windowGoalTimeline(entries, true)).toHaveLength(entries.length);
  });

  it('should open a year divider at the first row and at each year change only', () => {
    const { entries } = buildGoalMonthTimeline(
      makeInput({
        months: [
          makeMonth({ month: 11, year: 2026 }),
          makeMonth({ month: 12, year: 2026 }),
          makeMonth({ month: 1, year: 2027 }),
          makeMonth({ month: 2, year: 2027 }),
        ],
      }),
    );

    expect(
      windowGoalTimeline(entries, true)
        .filter((e) => e.showYear)
        .map((e) => e.year),
    ).toEqual([2026, 2027]);
  });
});
