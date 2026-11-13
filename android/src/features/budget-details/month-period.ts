import { getBudgetPeriodDates } from "pulpe-shared";

import { ofMonth } from "@/core/ui/date-format";

const MS_PER_DAY = 86_400_000;

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);

export interface PeriodProgress {
  start: Date;
  end: Date;
  /** Days left before the period starts; `null` once it has. */
  startsIn: number | null;
  /** « jour 10 sur 31 », only while the period is running. */
  day: { current: number; count: number } | null;
}

/**
 * Where "now" falls in a budget's period, for the line under the month's title
 * (`BudgetDetailsView.periodSubtitle`).
 */
export function periodProgress(
  month: number,
  year: number,
  payDayOfMonth: number | null,
  now: Date,
): PeriodProgress {
  const { startDate, endDate } = getBudgetPeriodDates(
    month,
    year,
    payDayOfMonth,
  );
  const untilStart = daysBetween(now, startDate);
  const elapsed = daysBetween(startDate, now);
  const count = daysBetween(startDate, endDate) + 1;
  const isRunning = elapsed >= 0 && elapsed < count;

  return {
    start: startDate,
    end: endDate,
    startsIn: untilStart > 0 ? untilStart : null,
    day: isRunning ? { current: elapsed + 1, count } : null,
  };
}

/** The month before, when this one has not started: the page reads as a projection. */
export function upcomingReportMonth(
  month: number,
  progress: PeriodProgress,
): number | null {
  if (progress.startsIn === null) return null;
  return month === 1 ? 12 : month - 1;
}

/** French writes « d'avril » rather than « de avril »: the other languages translate both keys alike. */
export function elidesMonth(monthName: string): boolean {
  return ofMonth(monthName).startsWith("d'");
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** « 25 oct. au 24 nov. · jour 10 sur 31 » — the day count only while the period runs. */
export function periodSubtitle(
  progress: PeriodProgress,
  formatDate: (date: Date) => string,
  t: Translate,
): string {
  const range = t("budgets.detail.period.range", {
    start: formatDate(progress.start),
    end: formatDate(progress.end),
  });
  if (progress.startsIn !== null) {
    return t("budgets.detail.period.startsIn", {
      range,
      count: progress.startsIn,
    });
  }
  return progress.day === null
    ? range
    : t("budgets.detail.period.day", {
        range,
        day: progress.day.current,
        count: progress.day.count,
      });
}
