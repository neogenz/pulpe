import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { calculateAllConsumptions } from '@core/budget/budget-line-consumption';
import { isRolloverLine } from '@core/rollover/rollover-types';
import {
  type BudgetLineTableItem,
  type TransactionTableItem,
} from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';

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
export class BudgetTableDataProvider {
  // Constantes pour l'ordre de tri
  readonly #RECURRENCE_ORDER: Record<TransactionRecurrence, number> = {
    fixed: 1,
    one_off: 2,
  } as const;

  readonly #KIND_ORDER: Record<TransactionKind, number> = {
    income: 1,
    saving: 2,
    expense: 3,
  } as const;

  // Constantes pour les labels et icônes
  readonly #KIND_ICONS: Record<TransactionKind, string> = {
    income: 'arrow_upward',
    expense: 'arrow_downward',
    saving: 'savings',
  } as const;

  readonly #ALLOCATION_LABELS: Record<TransactionKind, string> = {
    expense: 'Saisir une dépense',
    income: 'Saisir un revenu',
    saving: 'Saisir une épargne',
  } as const;

  readonly #TRANSACTION_COUNT_LABELS: Record<TransactionKind, string> = {
    expense: 'dépense',
    income: 'revenu',
    saving: 'épargne',
  } as const;

  /**
   * Combines and sorts budget lines and transactions with cumulative balance calculation
   */
  #composeBudgetItemsWithBalanceGrouped(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    includeAllocatedTransactions = false,
  ): BudgetItemWithBalance[] {
    const items = this.#createDisplayItems(
      budgetLines,
      transactions,
      includeAllocatedTransactions,
    );
    this.#sortItemsByBusinessRules(items);

    const consumptionMap = calculateAllConsumptions(budgetLines, transactions);
    this.#calculateCumulativeBalances(items, consumptionMap);

    return items;
  }

  #compareItems = (
    a: BudgetItemWithBalance,
    b: BudgetItemWithBalance,
  ): number => {
    if (a.itemType !== b.itemType) {
      return a.itemType === 'budget_line' ? -1 : 1;
    }

    if (a.itemType === 'budget_line') {
      return this.#compareBudgetLines(
        a.item as BudgetLine,
        b.item as BudgetLine,
      );
    }

    return this.#compareTransactions(
      a.item as Transaction,
      b.item as Transaction,
    );
  };

  #compareBudgetLines(a: BudgetLine, b: BudgetLine): number {
    const recurrenceDiff =
      (this.#RECURRENCE_ORDER[a.recurrence] ?? Number.MAX_SAFE_INTEGER) -
      (this.#RECURRENCE_ORDER[b.recurrence] ?? Number.MAX_SAFE_INTEGER);
    if (recurrenceDiff !== 0) return recurrenceDiff;

    const dateDiff = this.#compareDates(
      this.#getBudgetLineSortTimestamp(a),
      this.#getBudgetLineSortTimestamp(b),
    );
    if (dateDiff !== 0) return dateDiff;

    const kindDiff = this.#compareKinds(a.kind, b.kind);
    if (kindDiff !== 0) return kindDiff;

    return a.name.localeCompare(b.name);
  }

  #compareTransactions(a: Transaction, b: Transaction): number {
    const dateDiff = this.#compareDates(
      this.#getTransactionSortTimestamp(a),
      this.#getTransactionSortTimestamp(b),
    );
    if (dateDiff !== 0) return dateDiff;

    const kindDiff = this.#compareKinds(a.kind, b.kind);
    if (kindDiff !== 0) return kindDiff;

    return a.name.localeCompare(b.name);
  }

  #compareKinds(a: TransactionKind, b: TransactionKind): number {
    const aOrder = this.#KIND_ORDER[a] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = this.#KIND_ORDER[b] ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  }

  #compareDates(aTimestamp: number, bTimestamp: number): number {
    if (aTimestamp === bTimestamp) return 0;
    return aTimestamp - bTimestamp;
  }

  #getBudgetLineSortTimestamp(line: BudgetLine): number {
    return this.#safeParseDate(line.createdAt ?? null);
  }

  #getTransactionSortTimestamp(transaction: Transaction): number {
    return this.#safeParseDate(
      transaction.transactionDate ?? transaction.createdAt ?? null,
    );
  }

  #safeParseDate(value: string | null | undefined): number {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return Number.MAX_SAFE_INTEGER;
    return timestamp;
  }

  #createDisplayItems(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
    includeAllocatedTransactions = false,
  ): BudgetItemWithBalance[] {
    const items: BudgetItemWithBalance[] = [];

    budgetLines.forEach((line) => {
      items.push({
        item: line,
        cumulativeBalance: 0,
        itemType: 'budget_line',
      });
    });

    const transactionsToDisplay = includeAllocatedTransactions
      ? transactions
      : transactions.filter((tx) => !tx.budgetLineId);

    transactionsToDisplay.forEach((transaction) => {
      items.push({
        item: transaction,
        cumulativeBalance: 0,
        itemType: 'transaction',
      });
    });

    return items;
  }

  #sortItemsByBusinessRules(items: BudgetItemWithBalance[]): void {
    items.sort(this.#compareItems);
  }

  #calculateCumulativeBalances(
    items: BudgetItemWithBalance[],
    consumptionMap: Map<string, { consumed: number }>,
  ): void {
    let runningBalance = 0;

    items.forEach((item) => {
      const kind = item.item.kind;
      let effectiveAmount = item.item.amount;

      if (item.itemType === 'budget_line') {
        const consumption = consumptionMap.get(item.item.id);
        if (consumption) {
          effectiveAmount = Math.max(item.item.amount, consumption.consumed);
        }
      }

      const isAllocatedTransaction =
        item.itemType === 'transaction' &&
        !!(item.item as Transaction).budgetLineId;

      if (!isAllocatedTransaction) {
        const signedAmount = this.#getSignedAmount(kind, effectiveAmount);
        runningBalance += signedAmount;
      }

      item.cumulativeBalance = runningBalance;
    });
  }

  #getSignedAmount(kind: TransactionKind, amount: number): number {
    switch (kind) {
      case 'income':
        return amount;
      case 'expense':
      case 'saving':
        return -amount;
      default:
        return 0;
    }
  }

  // Méthodes pour les valeurs pré-calculées d'affichage
  #getKindIcon(kind: TransactionKind): string {
    return this.#KIND_ICONS[kind] ?? 'help';
  }

  #getAllocationLabel(kind: TransactionKind): string {
    return this.#ALLOCATION_LABELS[kind] ?? 'Saisir';
  }

  #getTransactionCountLabel(kind: TransactionKind, count: number): string {
    const label = this.#TRANSACTION_COUNT_LABELS[kind] ?? 'transaction';
    return `${count} ${label}${count > 1 ? 's' : ''}`;
  }

  #calculatePercentage(reserved: number, consumed: number): number {
    if (reserved <= 0) return 0;
    return Math.round((consumed / reserved) * 100);
  }

  #getRolloverSourceBudgetId(data: BudgetLine): string | undefined {
    return 'rolloverSourceBudgetId' in data
      ? (data as BudgetLine & { rolloverSourceBudgetId?: string })
          .rolloverSourceBudgetId
      : undefined;
  }

  /**
   * Provides budget table data for display with pre-computed display values
   */
  provideTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
    viewMode?: BudgetTableViewMode;
  }): (BudgetLineTableItem | TransactionTableItem)[] {
    const includeAllocatedTransactions = params.viewMode === 'transactions';

    // Map pour les noms d'enveloppes des transactions allouées
    const envelopeNameMap = new Map<string, string>();
    if (includeAllocatedTransactions) {
      params.budgetLines.forEach((line) => {
        envelopeNameMap.set(line.id, line.name);
      });
    }

    // Calculer les consommations pour les budget lines
    const consumptionMap = calculateAllConsumptions(
      params.budgetLines,
      params.transactions,
    );

    const itemsWithBalance = this.#composeBudgetItemsWithBalanceGrouped(
      params.budgetLines,
      params.transactions,
      includeAllocatedTransactions,
    );

    return itemsWithBalance.map((item) => {
      const isRollover = isRolloverLine(item.item);
      const isBudgetLine = item.itemType === 'budget_line';
      const budgetLine = isBudgetLine ? (item.item as BudgetLine) : null;
      const transaction = !isBudgetLine ? (item.item as Transaction) : null;
      const isPropagationLocked =
        isBudgetLine &&
        !!budgetLine?.templateLineId &&
        !!budgetLine?.isManuallyAdjusted;

      // Métadonnées de base + valeurs pré-calculées
      const baseMetadata = {
        itemType: item.itemType as 'budget_line' | 'transaction',
        cumulativeBalance: item.cumulativeBalance,
        isEditing:
          isBudgetLine && params.editingLineId === item.item.id && !isRollover,
        isRollover,
        isTemplateLinked: isBudgetLine ? !!budgetLine?.templateLineId : false,
        isPropagationLocked,
        canResetFromTemplate: isPropagationLocked,
        envelopeName: transaction?.budgetLineId
          ? (envelopeNameMap.get(transaction.budgetLineId) ?? null)
          : null,
        // Valeurs pré-calculées pour la vue
        kindIcon: this.#getKindIcon(item.item.kind),
        allocationLabel: this.#getAllocationLabel(item.item.kind),
        rolloverSourceBudgetId: budgetLine
          ? this.#getRolloverSourceBudgetId(budgetLine)
          : undefined,
      };

      if (isBudgetLine && budgetLine) {
        const consumption = consumptionMap.get(budgetLine.id);
        const consumed = consumption?.consumed ?? 0;
        const transactionCount = consumption?.transactionCount ?? 0;

        return {
          data: budgetLine,
          metadata: baseMetadata,
          consumption: {
            consumed,
            transactionCount,
            percentage: this.#calculatePercentage(budgetLine.amount, consumed),
            transactionCountLabel: this.#getTransactionCountLabel(
              budgetLine.kind,
              transactionCount,
            ),
            hasTransactions: transactionCount > 0,
          },
        } as BudgetLineTableItem;
      }

      return {
        data: item.item as Transaction,
        metadata: baseMetadata,
      } as TransactionTableItem;
    });
  }
}
