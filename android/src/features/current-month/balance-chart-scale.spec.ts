import {
  chartPlan,
  chartProjection,
  chartSpan,
  chartYDomain,
  showsTrendLabel,
} from "./balance-chart-scale";
import type { TrendedTrajectory } from "./current-month-view-model";

function trajectory(
  overrides: Partial<TrendedTrajectory> = {},
): TrendedTrajectory {
  return {
    landing: [
      { day: 0, balance: 2500 },
      { day: 2, balance: 2200 },
    ],
    plannedAvailable: 5000,
    real: [
      { day: 0, balance: 5000 },
      { day: 1, balance: 4800 },
      { day: 2, balance: 4700 },
    ],
    driftDate: new Date(2026, 6, 2),
    plannedOutflows: 2500,
    today: 2,
    totalDays: 31,
    plannedBalance: 2500,
    estimatedBalance: 2200,
    drift: -300,
    trend: 2000,
    ...overrides,
  };
}

describe("chartPlan", () => {
  it("falls straight from the opening amount to the planned balance", () => {
    expect(chartPlan(trajectory())).toEqual([
      { day: 0, balance: 5000 },
      { day: 31, balance: 2500 },
    ]);
  });
});

describe("chartProjection", () => {
  it("runs from the last real reading to the trend at the period's end", () => {
    expect(chartProjection(trajectory())).toEqual([
      { day: 2, balance: 4700 },
      { day: 31, balance: 2000 },
    ]);
  });

  it("has nothing left to project on the last day of the period", () => {
    expect(chartProjection(trajectory({ today: 31 }))).toEqual([]);
  });

  it("has nothing to start from without a real reading", () => {
    expect(chartProjection(trajectory({ real: [] }))).toEqual([]);
  });
});

describe("chartYDomain", () => {
  it("contains every plotted value", () => {
    const [lower, upper] = chartYDomain(trajectory({ trend: 1000 }));

    expect(lower).toBeLessThan(1000);
    expect(upper).toBeGreaterThan(5000);
  });

  // 2 500 planned out, so the floor is 125: wider than the 40 the month moved.
  const quiet = trajectory({
    plannedAvailable: 2500,
    plannedBalance: 2500,
    real: [
      { day: 0, balance: 2500 },
      { day: 1, balance: 2460 },
    ],
    trend: 2460,
  });

  it("keeps a quiet month from filling the frame", () => {
    const [lower, upper] = chartYDomain(quiet);

    expect(upper - lower).toBeGreaterThan(125);
  });

  it("puts three quarters of the slack below the readings", () => {
    const [lower, upper] = chartYDomain(quiet);
    const slack = chartSpan(quiet) - 40;
    const padding = chartSpan(quiet) * 0.12;

    expect(2460 - lower).toBeCloseTo(slack * 0.75 + padding, 6);
    expect(upper - 2500).toBeCloseTo(slack * 0.25 + padding, 6);
  });

  it("ignores the trend on the last day, where it is not drawn", () => {
    const [lower] = chartYDomain(trajectory({ today: 31, trend: -4000 }));

    expect(lower).toBeGreaterThan(-4000);
  });

  it("still leaves room around a flat month", () => {
    const [lower, upper] = chartYDomain(
      trajectory({
        plannedAvailable: 0,
        plannedBalance: 0,
        real: [{ day: 0, balance: 0 }],
        plannedOutflows: 0,
        trend: 0,
      }),
    );

    expect(lower).toBeLessThan(0);
    expect(upper).toBeGreaterThan(0);
  });
});

describe("showsTrendLabel", () => {
  it("speaks a trend visibly apart from the plan", () => {
    expect(showsTrendLabel(trajectory())).toBe(true);
  });

  it("stays quiet when the trend lands on the plan or beside it", () => {
    expect(showsTrendLabel(trajectory({ trend: 2500 }))).toBe(false);
    expect(showsTrendLabel(trajectory({ trend: 2501 }))).toBe(false);
  });

  it("stays quiet on the last day", () => {
    expect(showsTrendLabel(trajectory({ today: 31 }))).toBe(false);
  });
});
