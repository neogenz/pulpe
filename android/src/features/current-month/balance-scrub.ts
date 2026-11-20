import type {
  BalanceTrajectoryPoint as Point,
  SupportedCurrency,
} from "pulpe-shared";
import type { TranslateOptions } from "i18n-js";

import { formatCompactCurrency } from "@/core/ui/amount-format";
import { formatDayMonth } from "@/core/ui/date-format";

import { chartPlan, chartProjection } from "./balance-chart-scale";
import type { TrendedTrajectory } from "./current-month-view-model";

type Translate = (key: string, options?: TranslateOptions) => string;

/**
 * What the plot knows about one day: what the plan expected, what was really
 * left (up to today), where the estimate passes (after today). Port of
 * `HomeHeroCard.ScrubReading` in Swift.
 */
export interface ScrubReading {
  day: number;
  date: Date;
  real: number | null;
  plan: number;
  estimate: number | null;
}

/**
 * The reading under the finger. The plan and the estimate are straight lines,
 * so they are interpolated; the real stroke is read point by point. Day 1 is the
 * period's first day; the chart's day 0 reads as that day too.
 */
export function scrubReading(
  rawDay: number,
  trajectory: TrendedTrajectory,
  periodStart: Date,
): ScrubReading {
  const day = Math.min(Math.max(Math.round(rawDay), 0), trajectory.totalDays);
  const projection = chartProjection(trajectory);
  const date = new Date(periodStart);
  date.setDate(date.getDate() + Math.max(day - 1, 0));
  return {
    day,
    date,
    real: trajectory.real.find((point) => point.day === day)?.balance ?? null,
    plan: interpolate(chartPlan(trajectory), day),
    estimate:
      day > trajectory.today && projection.length > 0
        ? interpolate(projection, day)
        : null,
  };
}

/** What the hero prints while scrubbing: the real reading, else the estimate. */
export function scrubFigure(reading: ScrubReading): number {
  return reading.real ?? reading.estimate ?? reading.plan;
}

/**
 * The eyebrow while scrubbing: « Réel le 12 août · Prévu 7’400 CHF », or
 * « Estimé le 20 août · … » once the day is still to come.
 */
export function scrubEyebrow(
  t: Translate,
  locale: string,
  reading: ScrubReading,
  currency: SupportedCurrency,
  amountsHidden: boolean,
): string {
  const lead = reading.real === null ? "estimated" : "real";
  const date = formatDayMonth(reading.date, locale);
  return amountsHidden
    ? t(`home.hero.scrub.${lead}`, { date })
    : t(`home.hero.scrub.${lead}WithPlan`, {
        date,
        amount: formatCompactCurrency(reading.plan, currency),
      });
}

/** The day under a touch at `x` of a plot `width` wide spanning the whole period. */
export function scrubDayAt(
  x: number,
  width: number,
  totalDays: number,
): number {
  if (width <= 0) return 0;
  return Math.min(Math.max(Math.round((x / width) * totalDays), 0), totalDays);
}

function interpolate(points: Point[], day: number): number {
  const [first, last] = [points[0], points[points.length - 1]];
  if (first === undefined || last === undefined) return 0;
  if (last.day <= first.day) return last.balance;
  const span = last.day - first.day;
  const offset = Math.min(Math.max(day, first.day), last.day) - first.day;
  // In whole centimes, divided once: iOS interpolates in `Decimal`, and float
  // francs land a half centime on 0.00499… where iOS reads 0.005.
  const [from, to] = [toCents(first.balance), toCents(last.balance)];
  return roundHalfAway((from * span + (to - from) * offset) / span) / 100;
}

/** Whole centimes, half away from zero like Swift's `rounded(2)`. */
export function toCents(balance: number): number {
  return roundHalfAway(balance * 100);
}

/** Half away from zero like Swift's `rounded(2)`: `Math.round` sends a negative half up. */
function roundHalfAway(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value));
}
