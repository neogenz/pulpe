import type { BudgetSparse } from "pulpe-shared";

import { balanceForecasts, forecastOutlook } from "./balance-forecast";

const budget = (year: number, month: number, remaining: number) =>
  ({ id: `${year}-${month}`, year, month, remaining }) as BudgetSparse;

const forecast = (month: number, balance: number) => ({
  month,
  year: 2026,
  balance,
});

describe("balanceForecasts", () => {
  it("covers six months from the period in force, across the new year", () => {
    const budgets = [
      budget(2026, 10, 1),
      ...[11, 12].map((month) => budget(2026, month, month)),
      ...[1, 2, 3, 4, 5].map((month) => budget(2027, month, month)),
    ];

    const forecasts = balanceForecasts(budgets, { month: 11, year: 2026 });

    expect(forecasts.map(({ year, month }) => `${year}-${month}`)).toEqual([
      "2026-11",
      "2026-12",
      "2027-1",
      "2027-2",
      "2027-3",
      "2027-4",
    ]);
  });

  it("leaves out a month that has no budget", () => {
    const forecasts = balanceForecasts([budget(2026, 12, 40)], {
      month: 11,
      year: 2026,
    });

    expect(forecasts).toEqual([{ year: 2026, month: 12, balance: 40 }]);
  });
});

describe("forecastOutlook", () => {
  const nov = forecast(11, 1180);
  const dec = forecast(12, -40);
  const jan = forecast(1, 0);
  const feb = forecast(2, -300);

  it("names where the balance turns", () => {
    expect(forecastOutlook([nov, jan])).toEqual({
      kind: "staysPositive",
      forecast: jan,
    });
    expect(forecastOutlook([nov, dec, jan])).toEqual({
      kind: "tightens",
      forecast: dec,
    });
    expect(forecastOutlook([dec, jan, feb])).toEqual({
      kind: "recovers",
      forecast: jan,
    });
    expect(forecastOutlook([dec, feb])).toEqual({
      kind: "staysNegative",
      forecast: feb,
    });
    expect(forecastOutlook([])).toBeNull();
  });
});
