import {
  type Budget,
  type BudgetLineWithConsumption,
  type Transaction,
} from '@pulpe/shared';

export type BudgetDetailsViewModel = {
  transactions: Transaction[];
  budgetLines: BudgetLineWithConsumption[];
} & Budget;
