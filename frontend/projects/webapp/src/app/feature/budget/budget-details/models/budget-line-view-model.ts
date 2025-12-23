import { type BudgetLineWithConsumption } from '@pulpe/shared';

export type BudgetLineViewModel = BudgetLineWithConsumption & {
  isEditing?: boolean;
  isDeleting?: boolean;
  isUpdating?: boolean;
};
