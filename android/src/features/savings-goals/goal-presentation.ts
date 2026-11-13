import {
  getBudgetPeriodForDate,
  type SavingsGoal,
  type SavingsGoalPlannedWithdrawal,
  type SavingsGoalPlanMonth,
  type SavingsGoalPlanOnlyWithdrawal,
  type SavingsGoalProgress,
  type SavingsGoalStatus,
  type SavingsGoalWithdrawal,
  type SupportedCurrency,
} from "pulpe-shared";

import { formatCompactCurrency, formatCurrency } from "@/core/ui/amount-format";
import {
  formatDayMonth,
  formatMonthLabel,
  formatMonthName,
  parseIsoDate,
} from "@/core/ui/date-format";

import { hasClosedPlanMonth } from "./goals-vm";
import { roundUpToCentime } from "./round-up-to-centime";

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** What every sentence needs to be worded the way the reader reads it. */
export interface Words {
  t: Translate;
  locale: string;
  currency: SupportedCurrency;
}

/** `juin 2027`, or `Juin 2027` where it opens a line. */
function monthYear(
  month: number,
  year: number,
  capitalized: boolean,
  locale: string,
): string {
  return capitalized
    ? formatMonthLabel(month, year, locale)
    : `${formatMonthName(month, year, locale)} ${year}`;
}

function monthInText(month: number, year: number, locale: string): string {
  return formatMonthName(month, year, locale);
}

/** The last day a linked forecast of these months was pointed. */
function latestChecked(lines: { checkedAt: string | null }[]): Date | null {
  const stamps = lines
    .map((line) => line.checkedAt)
    .filter((stamp): stamp is string => stamp !== null)
    .map((stamp) => new Date(stamp).getTime());
  return stamps.length === 0 ? null : new Date(Math.max(...stamps));
}

export interface GoalHero {
  /** « sur 6’000.00 · dont 400.00 de départ ». */
  caption: string | null;
  /** The span under the name: « Juin 2026 → juin 2027 », « Échéance … », « Depuis … ». */
  dateLine: string | null;
  bar: {
    fraction: number;
    percent: number;
    /** « il reste X », « il manque X » or « cible atteinte le … ». */
    trailing: string | null;
    isMuted: boolean;
  } | null;
  /** « Vise X par mois pour finir en juin. Depuis août, tu mets Y par mois. » */
  sentence: string | null;
}

/**
 * Everything the goal's hero shows, resolved once from the server progression
 * (`GoalHeroPresentation.swift`). The pace sentence belongs to the ordinary
 * state only: an overdue, reached or paused goal says what to do in its own
 * card.
 */
export function goalHero(
  progress: SavingsGoalProgress,
  status: SavingsGoalStatus,
  words: Words,
): GoalHero {
  const { t, locale, currency } = words;
  const target = progress.targetAmount;
  const initial = progress.initialAmount > 0 ? progress.initialAmount : null;
  const money = (value: number) => formatCurrency(value, currency);

  let caption: string | null = null;
  if (target !== null && initial !== null) {
    caption = t("goals.hero.captionBoth", {
      target: money(target),
      initial: money(initial),
    });
  } else if (target !== null) {
    caption = t("goals.hero.captionTarget", { target: money(target) });
  } else if (initial !== null) {
    caption = t("goals.hero.captionInitial", { initial: money(initial) });
  }

  const start =
    progress.startDate === null ? null : parseIsoDate(progress.startDate);
  const end =
    progress.targetDate === null ? null : parseIsoDate(progress.targetDate);
  let dateLine: string | null = null;
  if (start !== null && end !== null) {
    dateLine = `${monthYear(start.getMonth() + 1, start.getFullYear(), true, locale)} → ${monthYear(end.getMonth() + 1, end.getFullYear(), false, locale)}`;
  } else if (end !== null) {
    dateLine = t("goals.detail.deadline", {
      date: monthYear(end.getMonth() + 1, end.getFullYear(), false, locale),
    });
  } else if (start !== null) {
    dateLine = t("goals.detail.since", {
      date: monthYear(start.getMonth() + 1, start.getFullYear(), false, locale),
    });
  }

  let bar: GoalHero["bar"] = null;
  if (target !== null && target > 0) {
    const left = target - progress.confirmed;
    let trailing: string;
    if (left <= 0) {
      const reachedOn = latestChecked(
        progress.months.flatMap((month) => month.lines),
      );
      trailing =
        reachedOn === null
          ? t("goals.hero.reached")
          : t("goals.hero.reachedOn", {
              date: formatDayMonth(reachedOn, locale),
            });
    } else {
      trailing = t(
        progress.isOverdue ? "goals.hero.short" : "goals.hero.left",
        {
          amount: money(left),
        },
      );
    }
    bar = {
      fraction: (progress.achievementPercent ?? 0) / 100,
      percent: progress.achievementPercent ?? 0,
      trailing,
      isMuted: status === "PAUSED",
    };
  }

  const isOrdinary =
    status === "ACTIVE" &&
    !progress.isOverdue &&
    progress.suggestCompletion !== true;
  const parts: string[] = [];
  if (isOrdinary && end !== null && progress.required !== null) {
    const required = roundUpToCentime(progress.required);
    if (required > 0) {
      parts.push(
        t("goals.hero.required", {
          amount: money(required),
          month: monthInText(end.getMonth() + 1, end.getFullYear(), locale),
        }),
      );
    }
  }
  if (
    isOrdinary &&
    start !== null &&
    progress.confirmedPace > 0 &&
    hasClosedPlanMonth(progress.months)
  ) {
    parts.push(
      t("goals.hero.pace", {
        month: monthInText(start.getMonth() + 1, start.getFullYear(), locale),
        amount: money(progress.confirmedPace),
      }),
    );
  }

  return {
    caption,
    dateLine,
    bar,
    sentence: parts.length === 0 ? null : parts.join(" "),
  };
}

/** « Mars à octobre », « Août et septembre », « Mars 2025 à septembre ». */
export function rangeTitle(
  months: SavingsGoalPlanMonth[],
  capitalized: boolean,
  words: Words,
): string {
  const first = months[0];
  const last = months[months.length - 1];
  if (first === undefined || last === undefined) return "";
  const { t, locale } = words;
  const firstName = capitalized
    ? formatMonthLabel(first.month, first.year, locale).replace(
        ` ${first.year}`,
        "",
      )
    : monthInText(first.month, first.year, locale);
  if (months.length === 1) return firstName;
  const lastName = monthInText(last.month, last.year, locale);
  if (first.year !== last.year) {
    return t("goals.detail.range.to", {
      first: `${firstName} ${first.year}`,
      last: lastName,
    });
  }
  return t(
    months.length === 2 ? "goals.detail.range.and" : "goals.detail.range.to",
    { first: firstName, last: lastName },
  );
}

/** A month the repair can write a linked forecast into. */
function isRepairable(month: SavingsGoalPlanMonth): boolean {
  return month.hasBudget === true && month.isProvisionable === true;
}

export function repairableMonths(
  months: SavingsGoalPlanMonth[],
): SavingsGoalPlanMonth[] {
  return months.filter(isRepairable);
}

/**
 * « Planifier mars à mai » on the repair path: exactly the months the repair
 * writes. An unbroken run, or two months of the same year, read as a range; a
 * gap reads as a count, so the title never names a month the repair skips.
 */
export function repairTitle(
  months: SavingsGoalPlanMonth[],
  words: Words,
): string | null {
  const repairable = repairableMonths(months);
  if (repairable.length === 0) return null;
  const isContiguous = repairable.every(
    (month, index) =>
      index === 0 ||
      month.year * 12 + month.month ===
        repairable[index - 1].year * 12 + repairable[index - 1].month + 1,
  );
  const isSameYearPair =
    repairable.length <= 2 &&
    repairable[0].year === repairable[repairable.length - 1].year;
  if (!isSameYearPair && !isContiguous) {
    return words.t("goals.detail.plan.planCount", { count: repairable.length });
  }
  return words.t("goals.detail.plan.plan", {
    range: rangeTitle(repairable, false, words),
  });
}

export interface MonthRun {
  /** `empty` carries no forecast: what « Planifier … » fills. */
  kind: "planned" | "empty";
  months: SavingsGoalPlanMonth[];
  title: string;
  subtitle: string;
  /** The sum the run puts aside, or null when it plans nothing. */
  amount: number | null;
}

/**
 * The months ahead as a few runs instead of one row per month: consecutive
 * months that carry a forecast, or consecutive months that carry none. The
 * current month belongs to « Ce mois-ci ».
 */
export function monthRuns(
  months: SavingsGoalPlanMonth[],
  words: Words,
): MonthRun[] {
  const { t, currency } = words;
  const runs: SavingsGoalPlanMonth[][] = [];
  for (const month of months) {
    if (month.state !== "future" && month.state !== "gap") continue;
    const run = runs[runs.length - 1];
    if (
      run !== undefined &&
      (run[0].lines.length === 0) === (month.lines.length === 0)
    ) {
      run.push(month);
    } else {
      runs.push([month]);
    }
  }
  return runs.map((run) => {
    const title = rangeTitle(run, true, words);
    if (run[0].lines.length === 0) {
      return {
        kind: "empty",
        months: run,
        title,
        subtitle: t(
          run.every((month) => month.hasBudget !== true)
            ? "goals.detail.run.noBudget"
            : "goals.detail.run.noLine",
        ),
        amount: null,
      };
    }
    const isUniform = run.every(
      (month) => month.plannedAmount === run[0].plannedAmount,
    );
    return {
      kind: "planned",
      months: run,
      title,
      subtitle: isUniform
        ? t("goals.detail.run.same", {
            count: run.length,
            amount: formatCurrency(run[0].plannedAmount, currency),
          })
        : t("goals.detail.run.planned", { count: run.length }),
      amount: run.reduce((total, month) => total + month.plannedAmount, 0),
    };
  });
}

/** « Planifier décembre à juin »: what the first empty run ahead would take. */
export function planTitle(runs: MonthRun[], words: Words): string | null {
  const empty = runs.find((run) => run.kind === "empty");
  return empty === undefined
    ? null
    : words.t("goals.detail.plan.plan", {
        range: rangeTitle(empty.months, false, words),
      });
}

export type UpcomingItem =
  | { id: string; sortKey: number; kind: "months"; run: MonthRun }
  | {
      id: string;
      sortKey: number;
      kind: "withdrawal";
      name: string;
      subtitle: string;
      amount: number;
      budgetId: string | null;
    };

/**
 * Months ahead and withdrawals still to come in one list, by date: what goes
 * in and what goes out read on the same line of time. A run comes before a
 * withdrawal of the same month; a withdrawal already fully made belongs to the
 * history.
 */
export function upcomingItems(
  runs: MonthRun[],
  planned: SavingsGoalPlannedWithdrawal[],
  planOnly: SavingsGoalPlanOnlyWithdrawal[],
  words: Words,
): UpcomingItem[] {
  const { t, locale, currency } = words;
  const items: UpcomingItem[] = [
    ...runs.map(
      (run): UpcomingItem => ({
        id: `months-${run.months[0].year}-${run.months[0].month}`,
        sortKey: (run.months[0].year * 100 + run.months[0].month) * 2,
        kind: "months",
        run,
      }),
    ),
    ...planned
      .filter((withdrawal) => withdrawal.status !== "realized")
      .map((withdrawal): UpcomingItem => {
        const status = t(`goals.withdrawals.status.${withdrawal.status}`);
        const detail =
          withdrawal.status === "planned"
            ? status
            : t("goals.withdrawals.detail", {
                status,
                planned: formatCurrency(withdrawal.plannedAmount, currency),
                realized: formatCurrency(withdrawal.realizedAmount, currency),
              });
        return {
          id: `linked-${withdrawal.budgetLineId}`,
          sortKey: (withdrawal.year * 100 + withdrawal.month) * 2 + 1,
          kind: "withdrawal",
          name: withdrawal.name,
          subtitle: `${formatMonthLabel(withdrawal.month, withdrawal.year, locale)} · ${detail}`,
          amount:
            withdrawal.status === "partially_realized"
              ? withdrawal.remainingAmount
              : withdrawal.plannedAmount,
          budgetId: withdrawal.budgetId,
        };
      }),
    ...planOnly.map(
      (withdrawal): UpcomingItem => ({
        id: `plan-only-${withdrawal.planWithdrawalId}`,
        sortKey: (withdrawal.year * 100 + withdrawal.month) * 2 + 1,
        kind: "withdrawal",
        name: withdrawal.name,
        subtitle: `${formatMonthLabel(withdrawal.month, withdrawal.year, locale)} · ${t("goals.withdrawals.inPlan")}`,
        amount: withdrawal.plannedAmount,
        budgetId: null,
      }),
    ),
  ];
  return items.sort((a, b) => a.sortKey - b.sortKey);
}

export interface ThisMonth {
  month: SavingsGoalPlanMonth;
  title: string;
  subtitle: string;
  isPointed: boolean;
}

/** The current month when it holds a forecast: what it asks and whether it is pointed. */
export function thisMonth(
  months: SavingsGoalPlanMonth[],
  status: SavingsGoalStatus,
  words: Words,
): ThisMonth | null {
  if (status !== "ACTIVE") return null;
  const month = months.find(
    (candidate) => candidate.state === "current" && candidate.lines.length > 0,
  );
  if (month === undefined) return null;
  const { t, locale, currency } = words;
  const isPointed = month.lines.every((line) => line.checkedAt !== null);
  const checked = latestChecked(month.lines);
  let subtitle: string;
  if (isPointed && checked !== null) {
    subtitle = t("goals.detail.month.checkedOn", {
      date: formatDayMonth(checked, locale),
    });
  } else if (month.confirmedAmount > 0) {
    subtitle = t("goals.detail.month.partial", {
      amount: formatCurrency(month.confirmedAmount, currency),
    });
  } else {
    subtitle = t("goals.detail.month.notChecked");
  }
  return {
    month,
    isPointed,
    title: t("goals.detail.month.planned", {
      month: formatMonthLabel(month.month, month.year, locale).replace(
        ` ${month.year}`,
        "",
      ),
      amount: formatCurrency(month.plannedAmount, currency),
    }),
    subtitle,
  };
}

export interface HistoryMonth {
  id: string;
  month: number;
  year: number;
  /** The pot at the end of the month; null outside the plan window. */
  endBalance: number | null;
  /** Only on the oldest month: what was already put aside at creation. */
  initialAmount: number | null;
  contribution: { amount: number; fraction: number; percent: number } | null;
  withdrawals: SavingsGoalWithdrawal[];
}

export interface GoalHistory {
  initialAmount: number;
  contributed: number;
  withdrawn: number;
  saved: number;
  pointedMonthCount: number;
  withdrawalCount: number;
  months: HistoryMonth[];
}

function contributionFraction(month: SavingsGoalPlanMonth): number {
  if (month.plannedAmount <= 0) return 1;
  return Math.min(Math.max(month.confirmedAmount / month.plannedAmount, 0), 1);
}

/**
 * What a goal's « Historique » tells: the account at the top (départ + versé −
 * retiré = mis de côté, so it always adds up to the hero figure), then one
 * group per month that moved, newest first. A month where nothing was pointed
 * and nothing left has no group.
 */
export function goalHistory(
  progress: SavingsGoalProgress,
  withdrawals: SavingsGoalWithdrawal[],
  payDayOfMonth: number | null,
): GoalHistory {
  const timeline = progress.months.filter(
    (month) => month.state === "past" || month.state === "current",
  );
  const withdrawn = withdrawals.reduce((sum, item) => sum + item.amount, 0);

  const byPeriod = new Map<number, SavingsGoalWithdrawal[]>();
  for (const withdrawal of withdrawals) {
    const period = getBudgetPeriodForDate(
      new Date(withdrawal.transactionDate),
      payDayOfMonth,
    );
    const key = period.year * 12 + period.month;
    byPeriod.set(key, [...(byPeriod.get(key) ?? []), withdrawal]);
  }

  const months: HistoryMonth[] = [];
  timeline.forEach((month, index) => {
    const key = month.year * 12 + month.month;
    const drawn = byPeriod.get(key) ?? [];
    byPeriod.delete(key);
    const initialAmount =
      index === 0 && progress.initialAmount > 0 ? progress.initialAmount : null;
    const contribution =
      month.confirmedAmount > 0
        ? {
            amount: month.confirmedAmount,
            fraction: contributionFraction(month),
            percent: Math.round(contributionFraction(month) * 100),
          }
        : null;
    if (initialAmount === null && contribution === null && drawn.length === 0) {
      return;
    }
    months.push({
      id: `${month.year}-${month.month}`,
      month: month.month,
      year: month.year,
      endBalance: month.confirmedCumulative,
      initialAmount,
      contribution,
      withdrawals: drawn,
    });
  });
  // A withdrawal the plan window does not reach still belongs in the story.
  for (const [key, drawn] of byPeriod) {
    const month = key % 12 === 0 ? 12 : key % 12;
    const year = (key - month) / 12;
    months.push({
      id: `${year}-${month}`,
      month,
      year,
      endBalance: null,
      initialAmount: null,
      contribution: null,
      withdrawals: drawn,
    });
  }
  months.sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));

  return {
    initialAmount: progress.initialAmount,
    contributed: progress.confirmed - progress.initialAmount + withdrawn,
    withdrawn,
    saved: progress.confirmed,
    pointedMonthCount: timeline.filter((month) => month.confirmedAmount > 0)
      .length,
    withdrawalCount: withdrawals.length,
    months,
  };
}

/** « 300.00 de départ, 2 mois pointés, 1 retrait ». */
export function historySummary(history: GoalHistory, words: Words): string {
  const { t, currency } = words;
  const parts: string[] = [];
  if (history.initialAmount > 0) {
    parts.push(
      t("goals.history.startAmount", {
        amount: formatCompactCurrency(history.initialAmount, currency),
      }),
    );
  }
  if (history.pointedMonthCount > 0) {
    parts.push(
      t("goals.history.pointed", { count: history.pointedMonthCount }),
    );
  }
  if (history.withdrawalCount > 0) {
    parts.push(
      t("goals.history.withdrawalCount", { count: history.withdrawalCount }),
    );
  }
  return parts.join(", ");
}

export interface GoalRowFact {
  chip: string | null;
  text: string | null;
}

/**
 * The one fact under a goal's bar: a chip that names its state, or a plain
 * line with the deadline and how many months still hold no forecast.
 */
export function goalRowFact(
  goal: SavingsGoal,
  progress: SavingsGoalProgress | undefined,
  words: Words,
): GoalRowFact {
  const { t, locale } = words;
  const deadline =
    goal.targetDate === null ? null : parseIsoDate(goal.targetDate);
  if (goal.status === "PAUSED") {
    return { chip: t("goals.list.sections.PAUSED"), text: null };
  }
  if (goal.status === "COMPLETED") {
    return { chip: t("goals.status.COMPLETED"), text: null };
  }
  if (progress?.suggestCompletion === true) {
    return {
      chip: t("goals.list.fact.reached"),
      text: t("goals.list.fact.toConfirm"),
    };
  }
  if (progress?.isOverdue === true) {
    return {
      chip: t("goals.list.fact.overdue"),
      text:
        deadline === null
          ? null
          : formatMonthName(
              deadline.getMonth() + 1,
              deadline.getFullYear(),
              locale,
            ),
    };
  }
  const open =
    progress?.months.filter(
      (month) => month.state !== "past" && month.lines.length === 0,
    ).length ?? 0;
  const parts = [
    deadline === null
      ? null
      : formatMonthLabel(
          deadline.getMonth() + 1,
          deadline.getFullYear(),
          locale,
        ),
    open > 0 ? t("goals.list.fact.toPlan", { count: open }) : null,
  ].filter((part): part is string => part !== null);
  return { chip: null, text: parts.length === 0 ? null : parts.join(" · ") };
}
