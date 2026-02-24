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
