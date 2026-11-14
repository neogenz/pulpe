import { BudgetFormulas, type TemplateLine } from "pulpe-shared";

export interface NoBudgetSummary {
  income: number;
  expenses: number;
  savings: number;
  available: number;
}

/** What a template would plan for a month: `HomeNoBudgetView`'s four figures. */
export function noBudgetSummary(lines: TemplateLine[]): NoBudgetSummary {
  const outflow = (kind: "expense" | "saving") =>
    BudgetFormulas.calculateTemplateTotals(
      lines.filter((line) => line.kind === kind),
    ).totalExpenses;
  const totals = BudgetFormulas.calculateTemplateTotals(lines);
  return {
    income: totals.totalIncome,
    expenses: outflow("expense"),
    savings: outflow("saving"),
    available: totals.balance,
  };
}
