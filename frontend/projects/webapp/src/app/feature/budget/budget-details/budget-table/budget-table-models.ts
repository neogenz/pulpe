import { type BudgetLine, type Transaction } from '@pulpe/shared';

/**
 * Simple table item using composition
 */
export interface TableItem {
  data: BudgetLine | Transaction;
  metadata: {
    itemType: 'budget_line' | 'transaction';
    cumulativeBalance: number;
    isEditing?: boolean;
    isRollover?: boolean;
    isTemplateLinked?: boolean;
    isPropagationLocked?: boolean;
    canResetFromTemplate?: boolean;
  };
}

export type BudgetLineTableItem = TableItem & {
  data: BudgetLine;
};
