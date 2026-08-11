import type { Budget, BudgetLine, Transaction } from 'pulpe-shared';

export interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
}

export interface HistoryDataPoint {
  id: string;
  month: number;
  year: number;
  income: number;
  // `totalExpenses` as the API sends it, so savings are inside — that is the
  // figure `available - totalExpenses` is defined against. `historyData()`
  // subtracts them before the chart draws "Dépenses" and "Épargne" side by
  // side; read that computed, not the raw resource, whenever the two are shown
  // as separate quantities.
  expenses: number;
  savings: number;
}

export interface UpcomingMonthForecast {
  month: number;
  year: number;
  hasBudget: boolean;
  income: number | null;
  expenses: number | null;
  savings: number | null;
}
