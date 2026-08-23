import type { BalanceTrajectory } from "pulpe-shared";

import { chartSeries, chartYDomain } from "./balance-chart-scale";

function trajectory(
  overrides: Partial<BalanceTrajectory> = {},
): BalanceTrajectory {
  return {
    landing: [
      { day: 0, balance: 2500 },
      { day: 1, balance: 2500 },
      { day: 2, balance: 2200 },
    ],
    plannedAvailable: 5000,
    real: [
      { day: 0, balance: 5000 },
      { day: 1, balance: 5000 },
      { day: 2, balance: 5000 },
    ],
    driftDate: new Date(2026, 6, 2),
    plannedOutflows: 2500,
    today: 2,
    totalDays: 31,
    plannedBalance: 2500,
    estimatedBalance: 2200,
    drift: -300,
    ...overrides,
  };
}

describe("chartSeries", () => {
  it("covers the whole period, not only the days lived", () => {
    expect(chartSeries(trajectory())).toHaveLength(32);
  });

  it("joins the two lines on the same day so no gap shows", () => {
    const series = chartSeries(trajectory());

    expect(series[2]).toEqual({ day: 2, landed: 2200, projected: 2200 });
    expect(series[1]?.projected).toBeNull();
    expect(series[3]?.landed).toBeNull();
  });

  it("holds the forecast flat over the days not yet lived", () => {
    const projected = chartSeries(trajectory())
      .slice(2)
      .map((point) => point.projected);

    expect(new Set(projected)).toEqual(new Set([2200]));
  });

  it("has nothing left to project on the last day of the period", () => {
    const series = chartSeries(
      trajectory({
        today: 31,
        landing: [
          { day: 0, balance: 2500 },
          { day: 31, balance: 2200 },
        ],
      }),
    );

    expect(series.filter((point) => point.projected !== null)).toHaveLength(1);
  });
});

describe("chartYDomain", () => {
  // 2 500 planned out, so the floor is 125 — wider than the 40 the month moved.
  it("keeps a quiet month from filling the frame", () => {
    const [lower, upper] = chartYDomain(
      trajectory({
        landing: [
          { day: 0, balance: 2500 },
          { day: 1, balance: 2460 },
        ],
        plannedOutflows: 2500,
      }),
    );

    expect(upper - lower).toBeGreaterThan(125);
  });

  it("centres the readings inside the room it claims", () => {
    const [lower, upper] = chartYDomain(
      trajectory({
        landing: [
          { day: 0, balance: 2500 },
          { day: 1, balance: 2460 },
        ],
      }),
    );

    expect(upper - 2500).toBeCloseTo(2460 - lower, 6);
  });

  it("still leaves room around a flat month", () => {
    const [lower, upper] = chartYDomain(
      trajectory({
        landing: [{ day: 0, balance: 0 }],
        plannedOutflows: 0,
      }),
    );

    expect(lower).toBeLessThan(0);
    expect(upper).toBeGreaterThan(0);
  });
});
