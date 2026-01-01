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
  type GroupHeaderTableItem,
  type TableRowItem,
  type TransactionTableItem,
} from './budget-table-models';
import type { BudgetTableViewMode } from './budget-table-view-mode';

/**
 * Discriminated union for budget items with cumulative balance calculation.
 * The itemType discriminant enables automatic type narrowing of the item field.
 */
type BudgetItemWithBalance =
  | { item: BudgetLine; cumulativeBalance: number; itemType: 'budget_line' }
  | { item: Transaction; cumulativeBalance: number; itemType: 'transaction' };

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

  readonly #GROUP_LABELS: Record<TransactionKind, string> = {
    income: 'Revenu',
    saving: 'Épargne',
    expense: 'Dépense',
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

    if (a.itemType === 'budget_line' && b.itemType === 'budget_line') {
      return this.#compareBudgetLines(a.item, b.item);
    }

    if (a.itemType === 'transaction' && b.itemType === 'transaction') {
      return this.#compareTransactions(a.item, b.item);
    }

    return 0;
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
        item.itemType === 'transaction' && !!item.item.budgetLineId;

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

  #insertGroupHeaders(
    items: (BudgetLineTableItem | TransactionTableItem)[],
  ): TableRowItem[] {
    if (items.length === 0) return [];

    const grouped = new Map<
      TransactionKind,
      (BudgetLineTableItem | TransactionTableItem)[]
    >();

    items.forEach((item) => {
      const kind = item.data.kind;
      if (!grouped.has(kind)) grouped.set(kind, []);
      grouped.get(kind)!.push(item);
    });

    const result: TableRowItem[] = [];
    const kindOrder: TransactionKind[] = ['income', 'saving', 'expense'];

    kindOrder.forEach((kind) => {
      const kindItems = grouped.get(kind);
      if (!kindItems?.length) return;

      result.push({
        metadata: {
          itemType: 'group_header',
          groupKind: kind,
          groupLabel: this.#GROUP_LABELS[kind],
          groupIcon: this.#KIND_ICONS[kind],
          itemCount: kindItems.length,
        },
      } as GroupHeaderTableItem);

      result.push(...kindItems);
    });

    return result;
  }

  /**
   * Builds data for transaction view mode with transactions nested under their parent envelopes.
   * Structure: Group Header → Envelope → Nested Transactions → Free Transactions
   */
  #buildNestedTransactionViewData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
  }): TableRowItem[] {
    const { budgetLines, transactions, editingLineId } = params;

    // 1. Separate allocated vs free transactions
    const allocatedByEnvelope = new Map<string, Transaction[]>();
    const freeTransactions: Transaction[] = [];

    transactions.forEach((tx) => {
      if (tx.budgetLineId) {
        const list = allocatedByEnvelope.get(tx.budgetLineId) ?? [];
        list.push(tx);
        allocatedByEnvelope.set(tx.budgetLineId, list);
      } else {
        freeTransactions.push(tx);
      }
    });

    // 2. Calculate consumptions for envelopes
    const consumptionMap = calculateAllConsumptions(budgetLines, transactions);

    // 3. Group envelopes by kind
    const envelopesByKind = new Map<TransactionKind, BudgetLine[]>();
    budgetLines.forEach((line) => {
      const list = envelopesByKind.get(line.kind) ?? [];
      list.push(line);
      envelopesByKind.set(line.kind, list);
    });

    // 4. Group free transactions by kind
    const freeByKind = new Map<TransactionKind, Transaction[]>();
    freeTransactions.forEach((tx) => {
      const list = freeByKind.get(tx.kind) ?? [];
      list.push(tx);
      freeByKind.set(tx.kind, list);
    });

    // 5. Build result with cumulative balance
    const result: TableRowItem[] = [];
    const kindOrder: TransactionKind[] = ['income', 'saving', 'expense'];
    let runningBalance = 0;

    kindOrder.forEach((kind) => {
      const envelopes = envelopesByKind.get(kind) ?? [];
      const freeTxs = freeByKind.get(kind) ?? [];

      if (envelopes.length === 0 && freeTxs.length === 0) return;

      // Sort envelopes by business rules
      envelopes.sort((a, b) => this.#compareBudgetLines(a, b));

      // Count items for header (envelopes + free transactions, not nested)
      const itemCount = envelopes.length + freeTxs.length;

      // Add group header
      result.push({
        metadata: {
          itemType: 'group_header',
          groupKind: kind,
          groupLabel: this.#GROUP_LABELS[kind],
          groupIcon: this.#KIND_ICONS[kind],
          itemCount,
        },
      } as GroupHeaderTableItem);

      // Add envelopes with their nested transactions
      envelopes.forEach((envelope) => {
        const consumption = consumptionMap.get(envelope.id);
        const consumed = consumption?.consumed ?? 0;
        const transactionCount = consumption?.transactionCount ?? 0;
        const effectiveAmount = Math.max(envelope.amount, consumed);

        // Update running balance for envelope
        runningBalance += this.#getSignedAmount(kind, effectiveAmount);

        const isRollover = isRolloverLine(envelope);
        const isPropagationLocked =
          !!envelope.templateLineId && !!envelope.isManuallyAdjusted;

        result.push({
          data: envelope,
          metadata: {
            itemType: 'budget_line',
            cumulativeBalance: runningBalance,
            isEditing: editingLineId === envelope.id && !isRollover,
            isRollover,
            isTemplateLinked: !!envelope.templateLineId,
            isPropagationLocked,
            canResetFromTemplate: isPropagationLocked,
            envelopeName: null,
            kindIcon: this.#getKindIcon(envelope.kind),
            allocationLabel: this.#getAllocationLabel(envelope.kind),
            rolloverSourceBudgetId: this.#getRolloverSourceBudgetId(envelope),
          },
          consumption: {
            consumed,
            transactionCount,
            percentage: this.#calculatePercentage(envelope.amount, consumed),
            transactionCountLabel: this.#getTransactionCountLabel(
              envelope.kind,
              transactionCount,
            ),
            hasTransactions: transactionCount > 0,
          },
        } satisfies BudgetLineTableItem);

        // Add nested transactions (sorted by date desc, then name)
        const nestedTxs = allocatedByEnvelope.get(envelope.id) ?? [];
        nestedTxs
          .sort((a, b) => this.#compareTransactions(a, b))
          .forEach((tx) => {
            // Nested transactions inherit parent's balance (no impact)
            result.push({
              data: tx,
              metadata: {
                itemType: 'transaction',
                cumulativeBalance: runningBalance,
                isEditing: false,
                isRollover: false,
                isTemplateLinked: false,
                isPropagationLocked: false,
                canResetFromTemplate: false,
                envelopeName: envelope.name,
                isNestedUnderEnvelope: true,
                kindIcon: this.#getKindIcon(tx.kind),
                allocationLabel: this.#getAllocationLabel(tx.kind),
                rolloverSourceBudgetId: undefined,
              },
            } satisfies TransactionTableItem);
          });
      });

      // Add free transactions (sorted)
      freeTxs
        .sort((a, b) => this.#compareTransactions(a, b))
        .forEach((tx) => {
          // Free transactions impact balance
          runningBalance += this.#getSignedAmount(tx.kind, tx.amount);

          result.push({
            data: tx,
            metadata: {
              itemType: 'transaction',
              cumulativeBalance: runningBalance,
              isEditing: false,
              isRollover: false,
              isTemplateLinked: false,
              isPropagationLocked: false,
              canResetFromTemplate: false,
              envelopeName: null,
              isNestedUnderEnvelope: false,
              kindIcon: this.#getKindIcon(tx.kind),
              allocationLabel: this.#getAllocationLabel(tx.kind),
              rolloverSourceBudgetId: undefined,
            },
          } satisfies TransactionTableItem);
        });
    });

    return result;
  }

  /**
   * Provides budget table data for display with pre-computed display values
   */
  provideTableData(params: {
    budgetLines: BudgetLine[];
    transactions: Transaction[];
    editingLineId: string | null;
    viewMode?: BudgetTableViewMode;
  }): TableRowItem[] {
    // Use nested view for transactions mode
    if (params.viewMode === 'transactions') {
      return this.#buildNestedTransactionViewData(params);
    }

    // Default: envelopes mode (only free transactions shown)
    const consumptionMap = calculateAllConsumptions(
      params.budgetLines,
      params.transactions,
    );

    const itemsWithBalance = this.#composeBudgetItemsWithBalanceGrouped(
      params.budgetLines,
      params.transactions,
      false,
    );

    const mappedItems = itemsWithBalance.map((item) => {
      const isRollover = isRolloverLine(item.item);

      if (item.itemType === 'budget_line') {
        const budgetLine = item.item;
        const isPropagationLocked =
          !!budgetLine.templateLineId && !!budgetLine.isManuallyAdjusted;

        const consumption = consumptionMap.get(budgetLine.id);
        const consumed = consumption?.consumed ?? 0;
        const transactionCount = consumption?.transactionCount ?? 0;

        return {
          data: budgetLine,
          metadata: {
            itemType: 'budget_line',
            cumulativeBalance: item.cumulativeBalance,
            isEditing: params.editingLineId === budgetLine.id && !isRollover,
            isRollover,
            isTemplateLinked: !!budgetLine.templateLineId,
            isPropagationLocked,
            canResetFromTemplate: isPropagationLocked,
            envelopeName: null,
            kindIcon: this.#getKindIcon(budgetLine.kind),
            allocationLabel: this.#getAllocationLabel(budgetLine.kind),
            rolloverSourceBudgetId: this.#getRolloverSourceBudgetId(budgetLine),
          },
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
        } satisfies BudgetLineTableItem;
      }

      const transaction = item.item;
      return {
        data: transaction,
        metadata: {
          itemType: 'transaction',
          cumulativeBalance: item.cumulativeBalance,
          isEditing: false,
          isRollover,
          isTemplateLinked: false,
          isPropagationLocked: false,
          canResetFromTemplate: false,
          envelopeName: null,
          kindIcon: this.#getKindIcon(transaction.kind),
          allocationLabel: this.#getAllocationLabel(transaction.kind),
          rolloverSourceBudgetId: undefined,
        },
      } satisfies TransactionTableItem;
    });

    return this.#insertGroupHeaders(mappedItems);
  }
}
