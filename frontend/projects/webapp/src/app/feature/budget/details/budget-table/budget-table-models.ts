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
  };
}

export type BudgetLineTableItem = TableItem & {
  data: BudgetLine;
};

/**
 * Simple budget table data using composition
 */
export interface BudgetTableData {
  items: TableItem[];
  summary: {
    hasOneOff: boolean;
    hasTransactions: boolean;
    isEmpty: boolean;
  };
}
