import type { SavingsGoalPlanMonth, SavingsGoalProgress } from "pulpe-shared";

import {
  buildPlanApply,
  isEditablePlanMonth,
  monthKey,
  pinnedAdjustments,
  planChanges,
  planVerdict,
  redistributedOverrides,
  simulatePlan,
} from "./plan-simulator";

function month(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 8,
    year: 2026,
    state: "future",
    isLocked: false,
    isContributionEligible: true,
    hasBudget: true,
    plannedAmount: 200,
    confirmedAmount: 0,
    plannedCumulative: 200,
    confirmedCumulative: 0,
    lines: [
      {
        budgetLineId: "11111111-1111-4111-8111-111111111111",
        amount: 200,
        checkedAt: null,
        isManuallyAdjusted: false,
      },
    ],
    ...overrides,
  };
}

function progress(
  months: SavingsGoalPlanMonth[],
  overrides: Partial<SavingsGoalProgress> = {},
): SavingsGoalProgress {
  return {
    goalId: "22222222-2222-4222-8222-222222222222",
    status: "ACTIVE",
    startDate: null,
    targetAmount: 1000,
    targetDate: null,
    plannedCumulative: 0,
    plannedProjection: 0,
    confirmed: 0,
    achievementPercent: 0,
    monthsElapsed: 1,
    monthsRemaining: months.length,
    isOverdue: false,
    pace: 0,
    confirmedPace: 0,
    required: null,
    projected: null,
    paceStatus: null,
    suggestCompletion: false,
    linkedLineCount: months.length,
    cumulativeGap: 0,
    estimatedCompletion: null,
    initialAmount: 0,
    months,
    originalTargetAmount: null,
    originalCurrency: null,
    targetCurrency: null,
    exchangeRate: null,
    ...overrides,
  };
}

const formatAmount = (amount: number) => `${amount} CHF`;
const formatPeriod = (period: { month: number; year: number }) =>
  `${period.month}/${period.year}`;

describe("isEditablePlanMonth", () => {
  it("keeps a past cycle out of reach", () => {
    expect(isEditablePlanMonth(month({ isLocked: true }))).toBe(false);
  });

  it("keeps a month whose withdrawal is already driven by the plan out of reach", () => {
    expect(isEditablePlanMonth(month({ planOnlyWithdrawalAmount: 150 }))).toBe(
      false,
    );
  });

  it("opens a month with an unchecked line", () => {
    expect(isEditablePlanMonth(month())).toBe(true);
  });

  it("opens a month with no budget yet", () => {
    expect(
      isEditablePlanMonth(month({ lines: [], isProvisionable: true })),
    ).toBe(true);
  });
});

describe("pinnedAdjustments", () => {
  it("pins a withdrawal month at the movement it already shows", () => {
    const withdrawal = month({
      month: 9,
      planOnlyWithdrawalAmount: 150,
      remainingPlannedWithdrawalAmount: 150,
    });

    expect(pinnedAdjustments([month(), withdrawal])).toEqual([
      { month: 9, year: 2026, amount: -150 },
    ]);
  });
});

describe("simulatePlan", () => {
  it("leaves the plan alone when nothing is overridden", () => {
    const months = [month({ month: 8 }), month({ month: 9 })];
    const result = simulatePlan(months, progress(months), {});

    expect(result.simulatedFinal).toBe(400);
    expect(planChanges(result)).toHaveLength(0);
  });

  it("carries an override into the total", () => {
    const months = [month({ month: 8 }), month({ month: 9 })];
    const result = simulatePlan(months, progress(months), {
      [monthKey({ month: 9, year: 2026 })]: 500,
    });

    expect(result.simulatedFinal).toBe(700);
    expect(planChanges(result).map((change) => change.month)).toEqual([9]);
  });

  it("starts from the amount already put aside", () => {
    const months = [month()];
    const result = simulatePlan(
      months,
      progress(months, { initialAmount: 300 }),
      {},
    );

    expect(result.simulatedFinal).toBe(500);
  });
});

describe("redistributedOverrides", () => {
  it("spreads what is left over the editable months", () => {
    const months = [month({ month: 8 }), month({ month: 9 })];

    expect(redistributedOverrides(months, progress(months))).toEqual({
      [monthKey({ month: 8, year: 2026 })]: 500,
      [monthKey({ month: 9, year: 2026 })]: 500,
    });
  });

  it("gives up when no month can move", () => {
    const months = [month({ isLocked: true })];

    expect(redistributedOverrides(months, progress(months))).toBeNull();
  });

  it("lands on the target once applied", () => {
    const months = [month({ month: 8 }), month({ month: 9 })];
    const overrides = redistributedOverrides(months, progress(months));
    const result = simulatePlan(months, progress(months), overrides ?? {});

    expect(result.simulatedFinal).toBe(1000);
    expect(result.isTargetMet).toBe(true);
  });
});

describe("buildPlanApply", () => {
  it("spreads a month's amount over its unchecked lines", () => {
    const months = [month()];
    const result = simulatePlan(months, progress(months), {
      [monthKey({ month: 8, year: 2026 })]: 320,
    });

    expect(buildPlanApply(planChanges(result))).toEqual({
      monthAdjustments: [
        {
          budgetLineId: "11111111-1111-4111-8111-111111111111",
          amount: 320,
        },
      ],
      missingMonthAdjustments: [],
    });
  });

  it("asks for a period when the month carries no budget yet", () => {
    const months = [month({ lines: [], isProvisionable: true })];
    const result = simulatePlan(months, progress(months), {
      [monthKey({ month: 8, year: 2026 })]: 400,
    });

    expect(buildPlanApply(planChanges(result))).toEqual({
      monthAdjustments: [],
      missingMonthAdjustments: [{ month: 8, year: 2026, amount: 400 }],
    });
  });

  it("refuses to send an empty plan", () => {
    expect(buildPlanApply([])).toBeNull();
  });

  it("drops a creation left at zero", () => {
    const months = [month({ lines: [], isProvisionable: true })];
    const result = simulatePlan(months, progress(months), {
      [monthKey({ month: 8, year: 2026 })]: 0,
    });

    expect(buildPlanApply(planChanges(result))).toBeNull();
  });
});

describe("planVerdict", () => {
  it("names the month the target is reached", () => {
    const months = [month({ month: 8 }), month({ month: 9 })];
    const result = simulatePlan(months, progress(months), {
      [monthKey({ month: 8, year: 2026 })]: 1000,
    });

    expect(planVerdict(result, formatAmount, formatPeriod)).toBe(
      "Avec ce plan, tu atteins ta cible en 8/2026.",
    );
  });

  it("names what is missing when the plan falls short", () => {
    const months = [month()];
    const result = simulatePlan(months, progress(months), {});

    expect(planVerdict(result, formatAmount, formatPeriod)).toBe(
      "Avec ce plan, il te manque 800 CHF pour ta cible.",
    );
  });

  it("states the total when there is no target", () => {
    const months = [month()];
    const result = simulatePlan(
      months,
      progress(months, { targetAmount: null }),
      {},
    );

    expect(planVerdict(result, formatAmount, formatPeriod)).toBe(
      "Avec ce plan, tu auras prévu 200 CHF.",
    );
  });
});
