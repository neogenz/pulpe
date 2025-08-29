import { Injectable, inject } from '@angular/core';
import { type Transaction, type BudgetLine } from '@pulpe/shared';
import { BudgetCalculator } from '@core/budget/budget-calculator';

/**
 * Simple table item using composition
 */
export interface TableItem {
  data: BudgetLine | Transaction;
  metadata: {
    itemType: 'budget_line' | 'transaction';
    cumulativeBalance: number;
    isEditing?: boolean;
    isLoading?: boolean;
    isRollover?: boolean;
  };
}

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

/**
 * Service that organizes budget data for table display.
 * Handles all presentation logic including grouping, sorting, and view model transformation.
 */
@Injectable()
export class BudgetTableMapper {
  readonly #budgetCalculator = inject(BudgetCalculator);

  /**
   * Prepares simple budget table data
   */
  prepareBudgetTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    operationsInProgress: Set<string>;
    editingLineId: string | null;
  }): BudgetTableData {
    const itemsWithBalance =
      this.#budgetCalculator.composeBudgetItemsWithBalanceGrouped(
        params.budgetLines,
        params.transactions,
      );

    const items: TableItem[] = itemsWithBalance.map((item) => {
      const isRollover =
        'isRollover' in item.item && item.item.isRollover === true;
      return {
        data: item.item,
        metadata: {
          itemType: item.itemType,
          cumulativeBalance: item.cumulativeBalance,
          isEditing:
            item.itemType === 'budget_line' &&
            params.editingLineId === item.item.id &&
            !isRollover, // Rollover lines cannot be edited
          isLoading: params.operationsInProgress.has(item.item.id),
          isRollover,
        },
      };
    });

    return {
      items,
      summary: {
        hasOneOff: items.some(
          (i) =>
            i.metadata.itemType === 'budget_line' &&
            'recurrence' in i.data &&
            i.data.recurrence === 'one_off',
        ),
        hasTransactions: items.some(
          (i) => i.metadata.itemType === 'transaction',
        ),
        isEmpty: items.length === 0,
      },
    };
  }
}
