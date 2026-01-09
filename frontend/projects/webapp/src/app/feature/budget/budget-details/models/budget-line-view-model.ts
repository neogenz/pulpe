import { type BudgetLine } from 'pulpe-shared';

export type BudgetLineViewModel = BudgetLine & {
  isEditing?: boolean;
  isDeleting?: boolean;
  isUpdating?: boolean;
};
