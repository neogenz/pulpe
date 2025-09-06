import { type Budget, type BudgetLine, type Transaction } from '@pulpe/shared';

export type BudgetDetails = {
  transactions: Transaction[];
  budgetLines: BudgetLine[];
} & Budget;
