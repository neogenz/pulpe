import type { Transaction, BudgetLine, TransactionKind } from 'pulpe-shared';
import { calculateAllConsumptions } from '@core/budget/budget-line-consumption';
import { isRolloverLine } from '@core/rollover/rollover-types';
import type {
  BudgetLineTableItem,
  GroupHeaderTableItem,
  TableRowItem,
  TransactionTableItem,
} from './budget-table-models';
import {
  KIND_ICONS,
  GROUP_LABELS,
  RECURRENCE_ORDER,
  KIND_ORDER,
  getKindIcon,
  getAllocationLabel,
  getTransactionCountLabel,
  calculatePercentage,
  getRolloverSourceBudgetId,
  safeParseDate,
} from './budget-table-constants';

type BudgetItemWithBalance =
  | { item: BudgetLine; cumulativeBalance: number; itemType: 'budget_line' }
  | { item: Transaction; cumulativeBalance: number; itemType: 'transaction' };

function compareBudgetLines(a: BudgetLine, b: BudgetLine): number {
  const recurrenceDiff =
    (RECURRENCE_ORDER[a.recurrence] ?? Number.MAX_SAFE_INTEGER) -
    (RECURRENCE_ORDER[b.recurrence] ?? Number.MAX_SAFE_INTEGER);
  if (recurrenceDiff !== 0) return recurrenceDiff;

  const aTimestamp = safeParseDate(a.createdAt ?? null);
  const bTimestamp = safeParseDate(b.createdAt ?? null);
  const dateDiff = aTimestamp - bTimestamp;
  if (dateDiff !== 0) return dateDiff;

  const aKindOrder = KIND_ORDER[a.kind] ?? Number.MAX_SAFE_INTEGER;
  const bKindOrder = KIND_ORDER[b.kind] ?? Number.MAX_SAFE_INTEGER;
  const kindDiff = aKindOrder - bKindOrder;
  if (kindDiff !== 0) return kindDiff;

  return a.name.localeCompare(b.name);
}

function compareTransactions(a: Transaction, b: Transaction): number {
  const aTimestamp = safeParseDate(a.transactionDate ?? a.createdAt ?? null);
  const bTimestamp = safeParseDate(b.transactionDate ?? b.createdAt ?? null);
  const dateDiff = aTimestamp - bTimestamp;
  if (dateDiff !== 0) return dateDiff;

  const aKindOrder = KIND_ORDER[a.kind] ?? Number.MAX_SAFE_INTEGER;
  const bKindOrder = KIND_ORDER[b.kind] ?? Number.MAX_SAFE_INTEGER;
  const kindDiff = aKindOrder - bKindOrder;
  if (kindDiff !== 0) return kindDiff;

  return a.name.localeCompare(b.name);
}

function compareItems(
  a: BudgetItemWithBalance,
  b: BudgetItemWithBalance,
): number {
  if (a.itemType !== b.itemType) {
    return a.itemType === 'budget_line' ? -1 : 1;
  }

  if (a.itemType === 'budget_line' && b.itemType === 'budget_line') {
    return compareBudgetLines(a.item, b.item);
  }

  if (a.itemType === 'transaction' && b.itemType === 'transaction') {
    return compareTransactions(a.item, b.item);
  }

  return 0;
}

function getSignedAmount(kind: TransactionKind, amount: number): number {
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

function createDisplayItems(
  budgetLines: BudgetLine[],
  transactions: Transaction[],
): BudgetItemWithBalance[] {
  const items: BudgetItemWithBalance[] = [];

  budgetLines.forEach((line) => {
    items.push({
      item: line,
      cumulativeBalance: 0,
      itemType: 'budget_line',
    });
  });

  const freeTransactions = transactions.filter((tx) => !tx.budgetLineId);
  freeTransactions.forEach((transaction) => {
    items.push({
      item: transaction,
      cumulativeBalance: 0,
      itemType: 'transaction',
    });
  });

  return items;
}

function calculateCumulativeBalances(
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
      const signedAmount = getSignedAmount(kind, effectiveAmount);
      runningBalance += signedAmount;
    }

    item.cumulativeBalance = runningBalance;
  });
}

function insertGroupHeaders(
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
        groupLabel: GROUP_LABELS[kind],
        groupIcon: KIND_ICONS[kind],
        itemCount: kindItems.length,
      },
    } as GroupHeaderTableItem);

    result.push(...kindItems);
  });

  return result;
}

export function buildEnvelopesViewData(params: {
  budgetLines: BudgetLine[];
  transactions: Transaction[];
  editingLineId: string | null;
}): TableRowItem[] {
  const { budgetLines, transactions, editingLineId } = params;

  const consumptionMap = calculateAllConsumptions(budgetLines, transactions);
  const items = createDisplayItems(budgetLines, transactions);
  items.sort(compareItems);
  calculateCumulativeBalances(items, consumptionMap);

  const mappedItems = items.map((item) => {
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
          isEditing: editingLineId === budgetLine.id && !isRollover,
          isRollover,
          isTemplateLinked: !!budgetLine.templateLineId,
          isPropagationLocked,
          canResetFromTemplate: isPropagationLocked,
          envelopeName: null,
          kindIcon: getKindIcon(budgetLine.kind),
          allocationLabel: getAllocationLabel(budgetLine.kind),
          rolloverSourceBudgetId: getRolloverSourceBudgetId(budgetLine),
        },
        consumption: {
          consumed,
          transactionCount,
          percentage: calculatePercentage(budgetLine.amount, consumed),
          transactionCountLabel: getTransactionCountLabel(
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
        kindIcon: getKindIcon(transaction.kind),
        allocationLabel: getAllocationLabel(transaction.kind),
        rolloverSourceBudgetId: undefined,
      },
    } satisfies TransactionTableItem;
  });

  return insertGroupHeaders(mappedItems);
}
