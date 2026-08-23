import type { SavingsGoalPlanMonth, SavingsGoalProgress } from "pulpe-shared";

import { projectionSeries, projectionYDomain } from "./projection-series";

function month(
  overrides: Partial<SavingsGoalPlanMonth> = {},
): SavingsGoalPlanMonth {
  return {
    month: 8,
    year: 2026,
    state: "future",
    isLocked: false,
    plannedAmount: 250,
    confirmedAmount: 0,
    plannedCumulative: 0,
    confirmedCumulative: 0,
    lines: [],
    ...overrides,
  };
}

function progress(
  months: SavingsGoalPlanMonth[],
  overrides: Partial<SavingsGoalProgress> = {},
): SavingsGoalProgress {
  return {
    goalId: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
    status: "ACTIVE",
    startDate: null,
    targetAmount: 1000,
    targetDate: "2026-11-30",
    plannedCumulative: 500,
    plannedProjection: 1000,
    confirmed: 500,
    achievementPercent: 50,
    monthsElapsed: 2,
    monthsRemaining: 2,
    isOverdue: false,
    pace: 250,
    confirmedPace: 250,
    required: 250,
    projected: 1000,
    paceStatus: "on_track",
    suggestCompletion: false,
    linkedLineCount: 4,
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

const PLAN: SavingsGoalPlanMonth[] = [
  month({
    month: 8,
    state: "past",
    confirmedAmount: 250,
    confirmedCumulative: 250,
  }),
  month({
    month: 9,
    state: "current",
    confirmedAmount: 250,
    confirmedCumulative: 500,
  }),
  month({ month: 10 }),
  month({ month: 11 }),
];

describe("projectionSeries", () => {
  it("stops reality at the current month and starts the plan there", () => {
    const series = projectionSeries(progress(PLAN));

    expect(series.points.map((point) => point.confirmed)).toEqual([
      250,
      500,
      null,
      null,
    ]);
    expect(series.points.map((point) => point.projection)).toEqual([
      null,
      500,
      750,
      1000,
    ]);
  });

  it("ends the plan on the server's own projection, not on its running sum", () => {
    const series = projectionSeries(progress(PLAN, { projected: 980 }));

    expect(series.points[3].projection).toBe(980);
  });

  it("counts only what a month still owes", () => {
    const partiallyFunded = [
      ...PLAN.slice(0, 2),
      month({ month: 10, plannedAmount: 250, confirmedAmount: 100 }),
      month({ month: 11 }),
    ];

    const series = projectionSeries(
      progress(partiallyFunded, { projected: 900 }),
    );

    expect(series.points[2].projection).toBe(650);
  });

  it("collapses to a single point when the current month is the last one", () => {
    const series = projectionSeries(
      progress([month({ state: "current", confirmedCumulative: 500 })], {
        projected: 700,
      }),
    );

    expect(series.points).toEqual([
      { index: 0, confirmed: 500, projection: 700 },
    ]);
  });

  it("withholds the trend until a month has elapsed", () => {
    const fresh = projectionSeries(
      progress([month({ state: "current" }), month({ month: 9 })]),
    );

    expect(fresh.hasConfirmedTrend).toBe(false);
    expect(projectionSeries(progress(PLAN)).hasConfirmedTrend).toBe(true);
  });

  it("labels the start, the current month and the end", () => {
    const series = projectionSeries(progress(PLAN));

    expect(series.ticks.map((tick) => tick.month)).toEqual([9, 11]);
  });

  it("adds the anchor tick once it is far enough from the current month", () => {
    const long = [
      month({ month: 5, state: "past" }),
      month({ month: 6, state: "past" }),
      month({ month: 7, state: "past" }),
      month({ month: 8, state: "current" }),
      month({ month: 9 }),
    ];

    expect(
      projectionSeries(progress(long)).ticks.map((tick) => tick.month),
    ).toEqual([5, 8, 9]);
  });

  it("has nothing to draw without a plan", () => {
    expect(projectionSeries(progress([])).points).toEqual([]);
  });
});

describe("projectionYDomain", () => {
  it("starts at zero and leaves room above the highest of plan and target", () => {
    const [lower, upper] = projectionYDomain(projectionSeries(progress(PLAN)));

    expect(lower).toBe(0);
    expect(upper).toBeGreaterThan(1000);
  });
});
