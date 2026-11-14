import type { TranslateOptions } from "i18n-js";
import {
  BudgetFormulas,
  periodFromIndex,
  periodIndex,
  type BudgetLine,
  type BudgetSparse,
  type Transaction,
} from "pulpe-shared";

import { ofMonth } from "@/core/ui/date-format";

type Translate = (key: string, options?: TranslateOptions) => string;

/** Half a currency unit either way, inclusive: the webapp's `monthRecapOutcome`. */
const BALANCED_MARGIN = 0.5;

/**
 * The month that just closed, read once the next one has opened. Port of
 * `MonthRecap` in Swift: income and expenses come from the sparse budget list,
 * the carry-over from the current budget, whose `rollover` is by definition
 * where the closed month ended.
 */
export interface MonthRecap {
  budgetId: string;
  month: number;
  year: number;
  /** The month that opened after it, named in the carry-over sentence. */
  openedMonth: number;
  income: number;
  /** Every outflow, savings included. */
  expenses: number;
  savings: number;
  /** What the closed month itself inherited from the one before it. */
  previousRollover: number;
  /** The month's own result: income − expenses, without the inherited report. */
  endingBalance: number;
  carriedOver: number;
  /** "YYYY-MM": the dismissal is stored per closed month. */
  key: string;
}

export type RecapOutcome = "saved" | "overspent" | "balanced";

/** The previous period of `current`, or null when it has no budget. */
export function monthRecap(
  current: { month: number; year: number },
  budgets: BudgetSparse[],
  carriedOver: number,
): MonthRecap | null {
  const closed = periodFromIndex(periodIndex(current) - 1);
  const budget = budgets.find(
    (candidate) =>
      candidate.month === closed.month && candidate.year === closed.year,
  );
  if (budget === undefined) return null;

  const income = budget.totalIncome ?? 0;
  const expenses = budget.totalExpenses ?? 0;
  return {
    budgetId: budget.id,
    month: closed.month,
    year: closed.year,
    openedMonth: current.month,
    income,
    expenses,
    savings: budget.totalSavings ?? 0,
    previousRollover: budget.rollover ?? 0,
    endingBalance: income - expenses,
    carriedOver,
    key: `${closed.year}-${String(closed.month).padStart(2, "0")}`,
  };
}

/** The outflows that were spent, savings set apart: « Dépenses » in the Bilan. */
export function recapSpending(recap: MonthRecap): number {
  return recap.expenses - recap.savings;
}

export function recapOutcome(recap: MonthRecap): RecapOutcome {
  if (recap.endingBalance >= BALANCED_MARGIN) return "saved";
  if (recap.endingBalance <= -BALANCED_MARGIN) return "overspent";
  return "balanced";
}

/** French elides « de » before a vowel; the other catalogs share both keys. */
export function elidedKey(key: string, monthName: string): string {
  return ofMonth(monthName).startsWith("d'") ? `${key}Elided` : key;
}

/** What the closed month leaves: its carry-over when it has one, else its verdict. */
export function recapSubtitle(
  t: Translate,
  recap: MonthRecap,
  openedMonthName: string,
  formatAmount: (value: number) => string,
): string {
  if (recap.carriedOver > 0) {
    return t("home.recap.subtitleCarried", {
      amount: formatAmount(recap.carriedOver),
      month: openedMonthName,
    });
  }
  switch (recapOutcome(recap)) {
    case "saved":
      return t("home.recap.subtitleSaved", {
        amount: formatAmount(recap.endingBalance),
      });
    case "overspent":
      return t("home.recap.subtitleOverspent", {
        amount: formatAmount(-recap.endingBalance),
      });
    case "balanced":
      return t("home.recap.subtitleBalanced");
  }
}

export interface RecapFinding {
  title: string;
  subtitle: string;
  /** An overrun total, shown in the over-budget ink. Absent for a fact with no figure. */
  overrun?: number;
}

/**
 * « Ce qui a compté »: at most three facts read from the closed month's own
 * details: its savings, the forecasts that ran past their plan, and what was
 * pointed.
 */
export function recapFindings(
  t: Translate,
  lines: BudgetLine[],
  transactions: Transaction[],
  monthName: string,
  formatAmount: (value: number) => string,
): RecapFinding[] {
  const findings: RecapFinding[] = [];
  const available = (line: BudgetLine) =>
    BudgetFormulas.calculateConsumption(line, transactions).available;

  const savings = lines.filter((line) => line.kind === "saving");
  if (savings.length > 0) {
    const missing = savings.filter(
      (line) => line.checkedAt == null && available(line) > 0,
    );
    findings.push(
      missing.length === 0
        ? {
            title: t("home.recap.findings.savingsFull"),
            subtitle: savings
              .map((line) => `${line.name} ${formatAmount(line.amount)}`)
              .join(" · "),
          }
        : {
            title: t("home.recap.findings.savingsPartial"),
            subtitle: t("home.recap.findings.notPaid", {
              names: missing.map((line) => line.name).join(", "),
            }),
          },
    );
  }

  const overruns = lines
    .filter((line) => line.kind === "expense")
    .map((line) => ({ name: line.name, over: -available(line) }))
    .filter((entry) => entry.over > 0)
    .sort((a, b) => b.over - a.over);
  if (overruns.length > 0) {
    findings.push({
      title: t("home.recap.findings.overruns", { count: overruns.length }),
      subtitle: overruns.map((entry) => entry.name).join(", "),
      overrun: overruns.reduce((sum, entry) => sum + entry.over, 0),
    });
  }

  const pointed = transactions.filter((tx) => tx.checkedAt != null).length;
  const waiting =
    transactions.length -
    pointed +
    lines.filter((line) => line.checkedAt == null).length;
  const pointedSubtitle =
    pointed === 0
      ? t("home.recap.findings.nothingPointed", { month: monthName })
      : t("home.recap.findings.pointed", { count: pointed, month: monthName });
  if (waiting === 0 && pointed > 0) {
    findings.push({
      title: t("home.recap.findings.allPointed"),
      subtitle: pointedSubtitle,
    });
  } else if (waiting > 0) {
    findings.push({
      title: t("home.recap.findings.waiting", { count: waiting }),
      subtitle: pointedSubtitle,
    });
  }
  return findings;
}
