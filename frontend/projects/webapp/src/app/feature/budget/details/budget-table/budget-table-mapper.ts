import { Injectable, inject } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { BudgetCalculator } from '@core/budget/budget-calculator';
import { type BudgetTableData, type TableItem } from './budget-table-models';

/**
 * Interface for budget items with cumulative balance calculation
 * Used internally for presentation logic
 */
interface BudgetItemWithBalance {
  item: BudgetLine | Transaction;
  cumulativeBalance: number;
  itemType: 'budget_line' | 'transaction';
}

/**
 * Service that organizes budget data for table display.
 * Handles all presentation logic including grouping, sorting, and view model transformation.
 */
@Injectable()
export class BudgetTableMapper {
  readonly #budgetCalculator = inject(BudgetCalculator);

  // Constantes pour l'ordre de tri
  readonly #RECURRENCE_ORDER: Record<TransactionRecurrence, number> = {
    fixed: 1,
    variable: 1, // traité comme fixed
    one_off: 2,
  } as const;

  readonly #KIND_ORDER: Record<TransactionKind, number> = {
    income: 1,
    saving: 2,
    expense: 3,
  } as const;

  /**
   * Type guard to check if a budget item is a rollover line
   */
  #isRolloverBudgetLine(
    item: BudgetLine | Transaction,
  ): item is BudgetLine & { isRollover: true } {
    return 'isRollover' in item && item.isRollover === true;
  }

  /**
   * Combines and sorts budget lines and transactions with cumulative balance calculation
   * Order:
   * 1. Budget lines "fixed" (income → savings → expenses)
   * 2. Budget lines "one_off" (income → savings → expenses)
   * 3. Transactions (income → savings → expenses)
   */
  #composeBudgetItemsWithBalanceGrouped(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items = this.#createDisplayItems(budgetLines, transactions);
    this.#sortItemsByBusinessRules(items);
    this.#calculateCumulativeBalances(items);

    return items;
  }

  /**
   * Compare deux éléments pour déterminer leur ordre de tri
   * Règles: 1. budget_lines avant transactions 2. récurrence (fixed → one_off) 3. type (income → saving → expense)
   */
  #compareItems = (
    a: BudgetItemWithBalance,
    b: BudgetItemWithBalance,
  ): number => {
    // 1. budget_lines avant transactions
    if (a.itemType !== b.itemType) {
      return a.itemType === 'budget_line' ? -1 : 1;
    }

    // 2. Pour les budget_lines : récurrence (fixed/variable avant one_off)
    if (a.itemType === 'budget_line') {
      const aRecurrence = (a.item as BudgetLine).recurrence;
      const bRecurrence = (b.item as BudgetLine).recurrence;

      if (aRecurrence !== bRecurrence) {
        const aOrder = this.#RECURRENCE_ORDER[aRecurrence] ?? 3;
        const bOrder = this.#RECURRENCE_ORDER[bRecurrence] ?? 3;
        return aOrder - bOrder;
      }
    }

    // 3. Type de transaction (income → saving → expense)
    const aKindOrder = this.#KIND_ORDER[a.item.kind] ?? 4;
    const bKindOrder = this.#KIND_ORDER[b.item.kind] ?? 4;

    return aKindOrder - bKindOrder;
  };

  /**
   * Crée les éléments d'affichage pour le tri et le calcul des soldes
   */
  #createDisplayItems(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items: BudgetItemWithBalance[] = [];

    // Ajouter les budget lines
    budgetLines.forEach((line) => {
      items.push({
        item: line,
        cumulativeBalance: 0, // Sera calculé après tri
        itemType: 'budget_line',
      });
    });

    // Ajouter les transactions
    transactions.forEach((transaction) => {
      items.push({
        item: transaction,
        cumulativeBalance: 0, // Sera calculé après tri
        itemType: 'transaction',
      });
    });

    return items;
  }

  /**
   * Trie les éléments selon les règles métier
   */
  #sortItemsByBusinessRules(items: BudgetItemWithBalance[]): void {
    items.sort(this.#compareItems);
  }

  /**
   * Calcule les soldes cumulatifs pour tous les éléments
   * Utilise le BudgetCalculator pour les calculs métier purs
   */
  #calculateCumulativeBalances(items: BudgetItemWithBalance[]): void {
    const flatItems = items.map((item) => item.item);
    const itemsWithBalance =
      this.#budgetCalculator.enrichWithCumulativeBalance(flatItems);

    items.forEach((item, index) => {
      item.cumulativeBalance = itemsWithBalance[index].cumulativeBalance;
    });
  }

  /**
   * Prepares simple budget table data
   */
  prepareBudgetTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
  }): BudgetTableData {
    const itemsWithBalance = this.#composeBudgetItemsWithBalanceGrouped(
      params.budgetLines,
      params.transactions,
    );

    const items: TableItem[] = itemsWithBalance.map((item) => {
      const isRollover = this.#isRolloverBudgetLine(item.item);
      return {
        data: item.item,
        metadata: {
          itemType: item.itemType,
          cumulativeBalance: item.cumulativeBalance,
          isEditing:
            item.itemType === 'budget_line' &&
            params.editingLineId === item.item.id &&
            !isRollover, // Rollover lines cannot be edited
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
