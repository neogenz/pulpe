import {
  type BudgetLine,
  BudgetFormulas,
  getBudgetPeriodDates,
  type SupportedCurrency,
} from "pulpe-shared";

import { translate } from "@/core/i18n/i18n";
import { formatCompactCurrency } from "@/core/ui/amount-format";
import type { BudgetDetails } from "@/features/budgets/budget-api";

/**
 * The Monday-morning recap: what the week before recorded, and how the week
 * starting should go. Computed on the device because amounts only decrypt here.
 * Port of `WeeklyRecap` on iOS, from the current month's details alone (iOS
 * widens the history with the budget export, which Android does not hold).
 */
export interface WeeklyRecap {
  /** Movements dated in the 7 days before the recap. */
  movementCount: number;
  /** Room to spend this week; `null` when the recap falls outside the loaded period. */
  weekAllowance: number | null;
  /** Average free spending per week over the 4 weeks before; `null` without history. */
  usualWeekSpending: number | null;
  /** Unchecked monthly forecasts the user usually points this week, earliest first. */
  expectedLineNames: string[];
}

const DAYS_PER_WEEK = 7;
const HISTORY_WEEKS = 4;
const MILLISECONDS_PER_DAY = 86_400_000;
/** Half an hour ahead of the monthly 9:00 reminder, so a pay-day Monday never stacks both. */
const RECAP_HOUR = 8;
const RECAP_MINUTE = 30;
const MONDAY = 1;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Whole calendar days from `from` to `to`, immune to a DST hour. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MILLISECONDS_PER_DAY);
}

/** Next Monday 8:30, today included while 8:30 has not passed. */
export function nextRecapDate(after: Date): Date {
  const candidate = new Date(after);
  candidate.setHours(RECAP_HOUR, RECAP_MINUTE, 0, 0);
  candidate.setDate(
    candidate.getDate() +
      ((MONDAY - candidate.getDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK),
  );
  return candidate > after ? candidate : addDays(candidate, DAYS_PER_WEEK);
}

export function makeWeeklyRecap(
  fireDate: Date,
  { budget, transactions, budgetLines, checkingDays }: BudgetDetails,
  payDayOfMonth: number | null,
): WeeklyRecap {
  const weekStart = startOfDay(fireDate);
  const daysBefore = (count: number) => addDays(weekStart, -count);
  const datedBetween = (from: Date, to: Date) => (date: string) => {
    const instant = new Date(date);
    return instant >= from && instant < to;
  };

  const movementCount = transactions.filter((transaction) =>
    datedBetween(
      daysBefore(DAYS_PER_WEEK),
      weekStart,
    )(transaction.transactionDate),
  ).length;

  // A new user's empty weeks are not a habit: history is needed before "usually".
  const hasHistory = transactions.some(
    (transaction) => new Date(transaction.transactionDate) < daysBefore(21),
  );
  const spent = transactions
    .filter(
      (transaction) =>
        transaction.kind === "expense" &&
        (transaction.budgetLineId ?? null) === null &&
        datedBetween(
          daysBefore(DAYS_PER_WEEK * HISTORY_WEEKS),
          weekStart,
        )(transaction.transactionDate),
    )
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const usualWeekSpending =
    hasHistory && spent > 0 ? spent / HISTORY_WEEKS : null;

  const period = getBudgetPeriodDates(budget.month, budget.year, payDayOfMonth);
  const periodStart = startOfDay(period.startDate);
  const periodEnd = startOfDay(period.endDate);
  if (weekStart < periodStart || weekStart > periodEnd) {
    return {
      movementCount,
      weekAllowance: null,
      usualWeekSpending,
      expectedLineNames: [],
    };
  }

  const daysLeft = daysBetween(weekStart, periodEnd) + 1;
  const { remaining } = BudgetFormulas.calculateAllMetrics(
    budgetLines,
    transactions,
    budget.rollover ?? 0,
  );
  const weekAllowance =
    remaining > 0
      ? (remaining / daysLeft) * Math.min(DAYS_PER_WEEK, daysLeft)
      : 0;

  // `checkingDays` holds 1-based period days, so the week is expressed in them too.
  const firstPeriodDay = daysBetween(periodStart, weekStart) + 1;
  const days = checkingDays ?? {};
  const isExpectedThisWeek = (line: BudgetLine) => {
    const day = days[line.id];
    return (
      day !== undefined &&
      day >= firstPeriodDay &&
      day < firstPeriodDay + DAYS_PER_WEEK &&
      line.checkedAt === null &&
      line.isRollover !== true
    );
  };
  const expectedLineNames = budgetLines
    .filter(isExpectedThisWeek)
    .sort((a, b) => days[a.id] - days[b.id])
    .map((line) => line.name);

  return { movementCount, weekAllowance, usualWeekSpending, expectedLineNames };
}

const KEY = "settings.preferences.weeklyRecap";

/**
 * Resolved at scheduling, like the monthly copy: the content is frozen in the
 * notification, so the next sync after a language change re-renders it.
 * `showDetails` false keeps amounts and forecast names off the lock screen.
 */
export function weeklyRecapBody(
  recap: WeeklyRecap,
  currency: SupportedCurrency,
  showDetails: boolean,
): string {
  const lastWeek =
    recap.movementCount > 0
      ? translate(`${KEY}.lastWeek`, { count: recap.movementCount })
      : translate(`${KEY}.newWeek`);
  if (!showDetails) return lastWeek;

  const sentences: string[] = [];
  if (recap.weekAllowance !== null) {
    // Rounded once to the whole units shown, so the wording follows the figure.
    const allowance = Math.round(recap.weekAllowance);
    const usual =
      recap.usualWeekSpending === null
        ? 0
        : Math.round(recap.usualWeekSpending);
    if (allowance <= 0) {
      sentences.push(translate(`${KEY}.exhausted`));
    } else if (usual > 0) {
      sentences.push(
        translate(`${KEY}.allowanceUsual`, {
          amount: formatCompactCurrency(allowance, currency),
          usual: formatCompactCurrency(usual, currency),
        }),
      );
    } else {
      sentences.push(
        translate(`${KEY}.allowance`, {
          amount: formatCompactCurrency(allowance, currency),
        }),
      );
    }
  }
  if (recap.expectedLineNames.length > 0) {
    sentences.push(
      translate(`${KEY}.expected`, {
        names: recap.expectedLineNames.join(", "),
      }),
    );
  }
  // The week ahead goes first so the collapsed banner carries the amount; a week
  // with nothing noted leads with the nudge instead.
  if (recap.movementCount > 0) sentences.push(lastWeek);
  else sentences.unshift(lastWeek);
  return sentences.join(" ");
}
