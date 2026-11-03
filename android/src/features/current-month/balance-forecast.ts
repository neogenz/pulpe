import { type BudgetSparse, periodFromIndex, periodIndex } from "pulpe-shared";

/** As far ahead as the forecast looks, the period in force included. */
export const FORECAST_HORIZON_MONTHS = 6;

export interface MonthlyForecast {
  month: number;
  year: number;
  /** What the month plans to end on, carry-overs included. */
  balance: number;
}

/**
 * The coming months' planned end balances, from the period in force on and
 * across the new year — a forecast that stopped at December would show two
 * bars in November and none in December. A month without a budget is left out.
 * Mirrors `DashboardStore.balanceForecasts` on iOS.
 */
export function balanceForecasts(
  budgets: BudgetSparse[],
  period: { month: number; year: number },
): MonthlyForecast[] {
  const start = periodIndex(period);
  return Array.from({ length: FORECAST_HORIZON_MONTHS }, (_, offset) => {
    const { month, year } = periodFromIndex(start + offset);
    const balance = budgets.find(
      (budget) => budget.month === month && budget.year === year,
    )?.remaining;
    return balance === undefined ? null : { month, year, balance };
  }).filter((forecast) => forecast !== null);
}

export type ForecastOutlook = {
  kind: "staysPositive" | "tightens" | "recovers" | "staysNegative";
  /** The month the headline names: where the balance turns, or the last one. */
  forecast: MonthlyForecast;
};

/** Where the balance turns, which is what the forecast's headline says. */
export function forecastOutlook(
  forecasts: MonthlyForecast[],
): ForecastOutlook | null {
  const first = forecasts[0];
  const last = forecasts.at(-1);
  if (first === undefined || last === undefined) return null;

  if (first.balance >= 0) {
    const dip = forecasts.find((forecast) => forecast.balance < 0);
    return dip
      ? { kind: "tightens", forecast: dip }
      : { kind: "staysPositive", forecast: last };
  }
  const climb = forecasts.find((forecast) => forecast.balance >= 0);
  return climb
    ? { kind: "recovers", forecast: climb }
    : { kind: "staysNegative", forecast: last };
}
