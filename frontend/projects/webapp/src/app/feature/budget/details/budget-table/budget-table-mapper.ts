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
  displayOrder: number;
  itemType: 'budget_line' | 'transaction';
}

/**
 * Service that organizes budget data for table display.
 * Handles all presentation logic including grouping, sorting, and view model transformation.
 */
@Injectable()
export class BudgetTableMapper {
  readonly #budgetCalculator = inject(BudgetCalculator);

  // Configuration des ordres d'affichage
  readonly #DISPLAY_ORDER_CONFIG = {
    RECURRENCE_MULTIPLIER: 1000,
    KIND_MULTIPLIER: 100,
    TRANSACTION_OFFSET: 10000,
    INCOME: 1,
    SAVING: 2,
    EXPENSE: 3,
    DEFAULT: 4,
    RECURRENCE_FIXED: 1,
    RECURRENCE_ONE_OFF: 2,
    RECURRENCE_DEFAULT: 3,
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
   * Calcule l'ordre d'affichage selon les règles métier
   * Structure: [RÉCURRENCE][KIND][TYPE][INDEX]
   */
  #calculateDisplayOrder(
    kind: TransactionKind,
    recurrence: TransactionRecurrence,
    index: number,
    itemType: 'budget_line' | 'transaction',
  ): number {
    const recurrenceOrder = this.#getRecurrenceOrder(recurrence);
    const kindOrder = this.#getKindOrder(kind);

    const baseOrder =
      recurrenceOrder * this.#DISPLAY_ORDER_CONFIG.RECURRENCE_MULTIPLIER +
      kindOrder * this.#DISPLAY_ORDER_CONFIG.KIND_MULTIPLIER;

    const typeOffset =
      itemType === 'transaction'
        ? this.#DISPLAY_ORDER_CONFIG.TRANSACTION_OFFSET
        : 0;

    return baseOrder + typeOffset + index;
  }

  /**
   * Détermine l'ordre de tri par type selon les règles métier
   */
  #getKindOrder(kind: TransactionKind): number {
    switch (kind) {
      case 'income':
        return this.#DISPLAY_ORDER_CONFIG.INCOME;
      case 'saving':
        return this.#DISPLAY_ORDER_CONFIG.SAVING;
      case 'expense':
        return this.#DISPLAY_ORDER_CONFIG.EXPENSE;
      default:
        return this.#DISPLAY_ORDER_CONFIG.DEFAULT;
    }
  }

  /**
   * Détermine l'ordre de tri par récurrence selon les règles métier
   */
  #getRecurrenceOrder(recurrence: TransactionRecurrence): number {
    switch (recurrence) {
      case 'fixed':
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_FIXED;
      case 'one_off':
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_ONE_OFF;
      case 'variable':
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_FIXED; // Traiter comme fixed
      default:
        return this.#DISPLAY_ORDER_CONFIG.RECURRENCE_DEFAULT;
    }
  }

  /**
   * Crée les éléments d'affichage avec leurs ordres de tri
   */
  #createDisplayItems(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items: BudgetItemWithBalance[] = [];

    // Ajouter les budget lines avec ordre groupé par récurrence
    budgetLines.forEach((line, index) => {
      items.push({
        item: line,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: this.#calculateDisplayOrder(
          line.kind,
          line.recurrence,
          index,
          'budget_line',
        ),
        itemType: 'budget_line',
      });
    });

    // Ajouter les transactions avec ordre
    transactions.forEach((transaction, index) => {
      items.push({
        item: transaction,
        cumulativeBalance: 0, // Sera calculé après tri
        displayOrder: this.#calculateDisplayOrder(
          transaction.kind,
          'one_off', // Les transactions n'ont pas de récurrence, on les traite comme one_off
          index,
          'transaction',
        ),
        itemType: 'transaction',
      });
    });

    return items;
  }

  /**
   * Trie les éléments selon les règles métier
   */
  #sortItemsByBusinessRules(items: BudgetItemWithBalance[]): void {
    items.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  /**
   * Calcule les soldes cumulatifs pour tous les éléments
   * Utilise le BudgetCalculator pour les calculs métier purs
   */
  #calculateCumulativeBalances(items: BudgetItemWithBalance[]): void {
    const flatItems = items.map((item) => item.item);
    const itemsWithBalance =
      this.#budgetCalculator.calculateRunningBalances(flatItems);

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
