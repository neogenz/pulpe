import type { Budget, BudgetLine, Transaction } from 'pulpe-shared';

export interface DashboardData {
  budget: Budget | null;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
  checkingDays?: Record<string, number>;
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

/**
 * The month that just closed, read once the next one has opened. Income and
 * expenses come from the sparse history feed; the carry-over and the start of
 * the new month come from the current budget, whose `rollover` is by definition
 * where the closed month ended.
 */
export interface MonthRecap {
  budgetId: string;
  month: number;
  year: number;
  income: number;
  expenses: number;
  // The month's own result (`ending_balance`): income − expenses, without the
  // report it inherited.
  endingBalance: number;
  outcome: 'saved' | 'overspent' | 'balanced';
  carriedOver: number;
  startingAvailable: number;
}
