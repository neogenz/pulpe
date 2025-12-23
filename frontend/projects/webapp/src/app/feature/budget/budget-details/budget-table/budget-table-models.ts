import {
  type BudgetLineWithConsumption,
  type Transaction,
} from '@pulpe/shared';

/**
 * Simple table item using composition
 */
export interface TableItem {
  data: BudgetLineWithConsumption | Transaction;
  metadata: {
    itemType: 'budget_line' | 'transaction';
    cumulativeBalance: number;
    isEditing?: boolean;
    isRollover?: boolean;
    isTemplateLinked?: boolean;
    isPropagationLocked?: boolean;
    isLoading?: boolean;
  };
}

export type BudgetLineTableItem = TableItem & {
  data: BudgetLineWithConsumption;
};
