import {
  BudgetFormulas,
  type BudgetLine,
  type Transaction,
  type TransactionKind,
} from "pulpe-shared";
import type { TranslateOptions } from "i18n-js";

type Translate = (key: string, options?: TranslateOptions) => string;

export interface CalculationRow {
  title: string;
  caption?: string;
  /** The line's contribution to the disponible: positive in, negative out. */
  amount: number;
}

/**
 * « Le calcul » in words: the formula of the disponible, line by line. Every
 * figure is a `calculateAllMetrics` output on a slice of the month, so the
 * lines add up to `metrics.remaining` by construction. Port of
 * `CalculationPresentation.rows` in Swift.
 */
export function calculationRows(
  t: Translate,
  {
    budgetLines,
    transactions,
    rollover,
    reportTitle,
  }: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    rollover: number;
    reportTitle: string;
  },
): CalculationRow[] {
  const lines = budgetLines.filter((line) => line.isRollover !== true);
  const allocated = transactions.filter((tx) => tx.budgetLineId != null);
  const free = BudgetFormulas.calculateAllMetrics(
    [],
    transactions.filter((tx) => tx.budgetLineId == null),
  );
  const metrics = (kind: TransactionKind) =>
    BudgetFormulas.calculateAllMetrics(
      lines.filter((line) => line.kind === kind),
      allocated,
    );

  const rows: CalculationRow[] = lines
    .filter((line) => line.kind === "income")
    .map((line) => ({
      title: line.name,
      amount: BudgetFormulas.calculateAllMetrics([line], allocated).totalIncome,
    }));
  if (free.totalIncome !== 0) {
    rows.push({
      title: t("home.movements.unplanned"),
      caption: t("home.calculation.incomeUnplanned"),
      amount: free.totalIncome,
    });
  }
  if (rollover !== 0) rows.push({ title: reportTitle, amount: rollover });
  rows.push({
    title: t("home.calculation.expenses"),
    caption: t("home.calculation.expensesCaption"),
    amount: -metrics("expense").totalExpenses,
  });
  if (free.totalExpenses !== 0) {
    rows.push({
      title: t("home.movements.unplanned"),
      caption: t("home.calculation.expenseUnplanned"),
      amount: -free.totalExpenses,
    });
  }
  rows.push({
    title: t("home.calculation.savings"),
    amount: -metrics("saving").totalSavings,
  });
  return rows;
}

/**
 * What moved the month off its plan, named: the prévisions past their plan
 * with how far, then the expenses no prévision covers, largest first. `null`
 * when there is nothing to name. Port of `CalculationPresentation.gapCauses`.
 */
export function gapCauses(
  t: Translate,
  overruns: { name: string; overrun: number }[],
  unplannedOutflows: Transaction[],
  formatAmount: (value: number) => string,
): string | null {
  const parts = [
    ...overruns.map(({ name, overrun }) => `${name} +${formatAmount(overrun)}`),
    ...[...unplannedOutflows]
      .sort((a, b) => b.amount - a.amount)
      .map((tx) => `${tx.name} ${formatAmount(tx.amount)}`),
  ];
  return parts.length === 0 ? null : `${listed(t, parts)}.`;
}

/** "a", "a et b", "a, b et c", then "a, b et 3 autres". */
function listed(t: Translate, [first, second, third, ...rest]: string[]) {
  if (second === undefined) return first;
  if (third === undefined) {
    return t("home.calculation.list.two", { first, second });
  }
  if (rest.length === 0) {
    return t("home.calculation.list.three", { first, second, third });
  }
  return t("home.calculation.list.more", {
    first,
    second,
    count: rest.length + 1,
  });
}
