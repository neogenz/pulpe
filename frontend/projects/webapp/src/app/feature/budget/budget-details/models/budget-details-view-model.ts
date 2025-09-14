import { type Budget, type BudgetLine, type Transaction } from '@pulpe/shared';

export type BudgetDetailsViewModel = {
  transactions: Transaction[];
  budgetLines: BudgetLine[];
} & Budget;
