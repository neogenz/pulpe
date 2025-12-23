import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { isRolloverLine } from '@core/rollover/rollover-types';
import { type TableItem } from './budget-table-models';

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

  /**
   * Combines and sorts budget lines and transactions with cumulative balance calculation
   * Order:
   * 1. Budget lines grouped by recurrence: fixed → one_off
   *    Within each group: createdAt ascending, then kind (income → saving → expense)
   * 2. Transactions ordered by transactionDate ascending (fallback createdAt), then kind
   */
  #composeBudgetItemsWithBalanceGrouped(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items = this.#createDisplayItems(budgetLines, transactions);
    this.#sortItemsByBusinessRules(items);
    this.#calculateCumulativeBalances(items, transactions);

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

    // Ajouter uniquement les transactions LIBRES (sans budgetLineId)
    // Les transactions allouées sont affichées dans l'expandable de leur enveloppe
    transactions
      .filter((tx) => !tx.budgetLineId)
      .forEach((transaction) => {
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
   * Pour les budget lines avec des transactions allouées qui dépassent l'enveloppe,
   * on utilise le montant consommé au lieu du montant de l'enveloppe
   */
  #calculateCumulativeBalances(
    items: BudgetItemWithBalance[],
    allTransactions: Transaction[],
  ): void {
    // Pré-calculer le montant consommé par budget line
    const consumedByBudgetLine = new Map<string, number>();
    allTransactions
      .filter((tx) => tx.budgetLineId)
      .forEach((tx) => {
        const current = consumedByBudgetLine.get(tx.budgetLineId!) ?? 0;
        consumedByBudgetLine.set(tx.budgetLineId!, current + tx.amount);
      });

    // Calcul du solde cumulatif avec prise en compte des dépassements
    let runningBalance = 0;
    items.forEach((item) => {
      let effectiveAmount = item.item.amount;

      // Pour les budget lines, utiliser MAX(envelope, consumed) pour les dépenses/épargne
      if (item.itemType === 'budget_line') {
        const budgetLine = item.item as BudgetLine;
        const consumed = consumedByBudgetLine.get(budgetLine.id) ?? 0;

        // Si le montant consommé dépasse l'enveloppe, utiliser le montant consommé
        if (
          consumed > budgetLine.amount &&
          (budgetLine.kind === 'expense' || budgetLine.kind === 'saving')
        ) {
          effectiveAmount = consumed;
        }
      }

      // Appliquer le signe selon le type
      const signedAmount =
        item.item.kind === 'income' ? effectiveAmount : -effectiveAmount;
      runningBalance += signedAmount;
      item.cumulativeBalance = runningBalance;
    });
  }

  /**
   * Provides budget table data for display
   */
  provideTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
  }): TableItem[] {
    const itemsWithBalance = this.#composeBudgetItemsWithBalanceGrouped(
      params.budgetLines,
      params.transactions,
    );

    return itemsWithBalance.map((item) => {
      const isRollover = isRolloverLine(item.item);
      const isBudgetLine = item.itemType === 'budget_line';
      const budgetLine = isBudgetLine ? (item.item as BudgetLine) : null;
      return {
        data: item.item,
        metadata: {
          itemType: item.itemType,
          cumulativeBalance: item.cumulativeBalance,
          isEditing:
            isBudgetLine &&
            params.editingLineId === item.item.id &&
            !isRollover, // Rollover lines cannot be edited
          isRollover,
          isTemplateLinked: isBudgetLine ? !!budgetLine?.templateLineId : false,
          isPropagationLocked:
            isBudgetLine &&
            !!budgetLine?.templateLineId &&
            !!budgetLine?.isManuallyAdjusted,
        },
      };
    });
  }
}
