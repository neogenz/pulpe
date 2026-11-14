import type { BalanceTrajectory } from "pulpe-shared";

/** What the plot says about one day: the estimate it draws, against the plan. */
export interface ScrubReading {
  day: number;
  date: Date;
  /** The estimated balance on that day; held at the forecast past today. */
  estimate: number;
  plan: number;
  isPast: boolean;
}

/**
 * The reading under the finger. Reads what the chart draws: the landing line
 * up to today, the forecast held flat after it, and the plan's dashed rule.
 * Day 1 is the period's first day; the chart's day 0 reads as that day too.
 */
export function scrubReading(
  rawDay: number,
  trajectory: BalanceTrajectory,
  periodStart: Date,
): ScrubReading {
  const day = Math.min(Math.max(Math.round(rawDay), 0), trajectory.totalDays);
  const isPast = day <= trajectory.today;
  const landed = trajectory.landing.find((point) => point.day === day);
  const date = new Date(periodStart);
  date.setDate(date.getDate() + Math.max(day - 1, 0));
  return {
    day,
    date,
    estimate:
      isPast && landed !== undefined
        ? landed.balance
        : trajectory.estimatedBalance,
    plan: trajectory.plannedBalance,
    isPast,
  };
}

/** The day under a touch at `x` of a plot `width` wide spanning the whole period. */
export function scrubDayAt(
  x: number,
  width: number,
  totalDays: number,
): number {
  return width <= 0 ? 0 : Math.round((x / width) * totalDays);
}
