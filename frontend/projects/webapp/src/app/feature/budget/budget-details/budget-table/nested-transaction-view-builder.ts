import type { Transaction, BudgetLine, TransactionKind } from '@pulpe/shared';
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
  KIND_ORDER,
  getKindIcon,
  getAllocationLabel,
  getTransactionCountLabel,
  calculatePercentage,
  getRolloverSourceBudgetId,
  getSignedAmount,
  safeParseDate,
} from './budget-table-constants';

function compareBudgetLines(a: BudgetLine, b: BudgetLine): number {
  const RECURRENCE_ORDER = { fixed: 1, one_off: 2 } as const;

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

export function buildNestedTransactionViewData(params: {
  budgetLines: BudgetLine[];
  transactions: Transaction[];
  editingLineId: string | null;
}): TableRowItem[] {
  const { budgetLines, transactions, editingLineId } = params;

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

  const consumptionMap = calculateAllConsumptions(budgetLines, transactions);

  const envelopesByKind = new Map<TransactionKind, BudgetLine[]>();
  budgetLines.forEach((line) => {
    const list = envelopesByKind.get(line.kind) ?? [];
    list.push(line);
    envelopesByKind.set(line.kind, list);
  });

  const freeByKind = new Map<TransactionKind, Transaction[]>();
  freeTransactions.forEach((tx) => {
    const list = freeByKind.get(tx.kind) ?? [];
    list.push(tx);
    freeByKind.set(tx.kind, list);
  });

  const result: TableRowItem[] = [];
  const kindOrder: TransactionKind[] = ['income', 'saving', 'expense'];
  let runningBalance = 0;

  kindOrder.forEach((kind) => {
    const envelopes = envelopesByKind.get(kind) ?? [];
    const freeTxs = freeByKind.get(kind) ?? [];

    if (envelopes.length === 0 && freeTxs.length === 0) return;

    envelopes.sort((a, b) => compareBudgetLines(a, b));

    const itemCount = envelopes.length + freeTxs.length;

    result.push({
      metadata: {
        itemType: 'group_header',
        groupKind: kind,
        groupLabel: GROUP_LABELS[kind],
        groupIcon: KIND_ICONS[kind],
        itemCount,
      },
    } as GroupHeaderTableItem);

    envelopes.forEach((envelope) => {
      const consumption = consumptionMap.get(envelope.id);
      const consumed = consumption?.consumed ?? 0;
      const transactionCount = consumption?.transactionCount ?? 0;
      const effectiveAmount = Math.max(envelope.amount, consumed);

      runningBalance += getSignedAmount(kind, effectiveAmount);

      const envelopeIsRollover = isRolloverLine(envelope);
      const isPropagationLocked =
        !!envelope.templateLineId && !!envelope.isManuallyAdjusted;

      result.push({
        data: envelope,
        metadata: {
          itemType: 'budget_line',
          cumulativeBalance: runningBalance,
          isEditing: editingLineId === envelope.id && !envelopeIsRollover,
          isRollover: envelopeIsRollover,
          isTemplateLinked: !!envelope.templateLineId,
          isPropagationLocked,
          canResetFromTemplate: isPropagationLocked,
          envelopeName: null,
          kindIcon: getKindIcon(envelope.kind),
          allocationLabel: getAllocationLabel(envelope.kind),
          rolloverSourceBudgetId: getRolloverSourceBudgetId(envelope),
        },
        consumption: {
          consumed,
          transactionCount,
          percentage: calculatePercentage(envelope.amount, consumed),
          transactionCountLabel: getTransactionCountLabel(
            envelope.kind,
            transactionCount,
          ),
          hasTransactions: transactionCount > 0,
        },
      } satisfies BudgetLineTableItem);

      const nestedTxs = allocatedByEnvelope.get(envelope.id) ?? [];
      nestedTxs
        .sort((a, b) => compareTransactions(a, b))
        .forEach((tx) => {
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
              kindIcon: getKindIcon(tx.kind),
              allocationLabel: getAllocationLabel(tx.kind),
              rolloverSourceBudgetId: undefined,
            },
          } satisfies TransactionTableItem);
        });
    });

    freeTxs
      .sort((a, b) => compareTransactions(a, b))
      .forEach((tx) => {
        runningBalance += getSignedAmount(tx.kind, tx.amount);

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
            kindIcon: getKindIcon(tx.kind),
            allocationLabel: getAllocationLabel(tx.kind),
            rolloverSourceBudgetId: undefined,
          },
        } satisfies TransactionTableItem);
      });
  });

  return result;
}
