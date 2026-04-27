import { type BudgetLine } from 'pulpe-shared';

export type BudgetLineViewModel = BudgetLine & {
  isDeleting?: boolean;
  isUpdating?: boolean;
};
