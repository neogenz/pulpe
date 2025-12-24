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
    /** Number of transactions allocated to this budget line */
    allocatedTransactionsCount?: number;
    /** Total consumed amount from allocated transactions */
    consumedAmount?: number;
    /** Has transactions allocated to this budget line */
    hasAllocatedTransactions?: boolean;
    isLoading?: boolean;
  };
}

export type BudgetLineTableItem = TableItem & {
  data: BudgetLine;
};
