import { Injectable } from '@angular/core';
import {
  type Transaction,
  type BudgetLine,
  type TransactionKind,
  type TransactionRecurrence,
} from '@pulpe/shared';
import { calculateAllConsumptions } from '@core/budget/budget-line-consumption';
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
   *
   * Note: Le calcul du solde cumulatif utilise MAX(prévu, consommé) pour chaque enveloppe
   * afin de prendre en compte les dépassements.
   */
  #composeBudgetItemsWithBalanceGrouped(
    budgetLines: BudgetLine[],
    transactions: Transaction[],
  ): BudgetItemWithBalance[] {
    const items = this.#createDisplayItems(budgetLines, transactions);
    this.#sortItemsByBusinessRules(items);

    // Calculer les consommations de chaque enveloppe pour les dépassements
    const consumptionMap = calculateAllConsumptions(budgetLines, transactions);

    this.#calculateCumulativeBalances(items, consumptionMap);

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
   *
   * Note: Les transactions allouées (budgetLineId != null) sont exclues de l'affichage
   * car elles sont "contenues" dans leur enveloppe et ne doivent pas apparaître
   * comme des lignes séparées dans le tableau principal.
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

    // Ajouter seulement les transactions LIBRES (non allouées à une enveloppe)
    // Les transactions allouées sont visibles via la consommation de leur enveloppe
    const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
    freeTransactions.forEach((transaction) => {
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
   * Pour les enveloppes (budget lines), utilise MAX(montant_prévu, montant_consommé)
   * afin de prendre en compte les dépassements dans le solde restant.
   *
   * @param items Les éléments à enrichir avec le solde cumulatif
   * @param consumptionMap Map des consommations par budgetLineId
   */
  #calculateCumulativeBalances(
    items: BudgetItemWithBalance[],
    consumptionMap: Map<string, { consumed: number }>,
  ): void {
    let runningBalance = 0;

    items.forEach((item) => {
      const kind = item.item.kind;
      let effectiveAmount = item.item.amount;

      // Pour les budget lines, utiliser MAX(prévu, consommé) pour les dépassements
      if (item.itemType === 'budget_line') {
        const consumption = consumptionMap.get(item.item.id);
        if (consumption) {
          effectiveAmount = Math.max(item.item.amount, consumption.consumed);
        }
      }

      // Calculer l'impact signé selon le type
      const signedAmount = this.#getSignedAmount(kind, effectiveAmount);
      runningBalance += signedAmount;
      item.cumulativeBalance = runningBalance;
    });
  }

  /**
   * Retourne le montant avec le signe approprié selon le type
   */
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
