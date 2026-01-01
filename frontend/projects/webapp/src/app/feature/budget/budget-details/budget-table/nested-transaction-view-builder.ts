import type { Transaction, BudgetLine, TransactionKind } from '@pulpe/shared';
import { calculateAllConsumptions } from '@core/budget/budget-line-consumption';
import { isRolloverLine } from '@core/rollover/rollover-types';
import type {
  BudgetLineTableItem,
  GroupHeaderTableItem,
  TableRowItem,
  TransactionTableItem,
} from './budget-table-models';

const KIND_ICONS: Record<TransactionKind, string> = {
  income: 'arrow_upward',
  expense: 'arrow_downward',
  saving: 'savings',
} as const;

const ALLOCATION_LABELS: Record<TransactionKind, string> = {
  expense: 'Saisir une dépense',
  income: 'Saisir un revenu',
  saving: 'Saisir une épargne',
} as const;

const TRANSACTION_COUNT_LABELS: Record<TransactionKind, string> = {
  expense: 'dépense',
  income: 'revenu',
  saving: 'épargne',
} as const;

const GROUP_LABELS: Record<TransactionKind, string> = {
  income: 'Revenu',
  saving: 'Épargne',
  expense: 'Dépense',
} as const;

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

function getKindIcon(kind: TransactionKind): string {
  return KIND_ICONS[kind] ?? 'help';
}

function getAllocationLabel(kind: TransactionKind): string {
  return ALLOCATION_LABELS[kind] ?? 'Saisir';
}

function getTransactionCountLabel(
  kind: TransactionKind,
  count: number,
): string {
  const label = TRANSACTION_COUNT_LABELS[kind] ?? 'transaction';
  return `${count} ${label}${count > 1 ? 's' : ''}`;
}

function calculatePercentage(reserved: number, consumed: number): number {
  if (reserved <= 0) return 0;
  return Math.round((consumed / reserved) * 100);
}

function getRolloverSourceBudgetId(data: BudgetLine): string | undefined {
  return 'rolloverSourceBudgetId' in data
    ? (data as BudgetLine & { rolloverSourceBudgetId?: string })
        .rolloverSourceBudgetId
    : undefined;
}

function safeParseDate(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return Number.MAX_SAFE_INTEGER;
  return timestamp;
}

function compareBudgetLines(a: BudgetLine, b: BudgetLine): number {
  const RECURRENCE_ORDER = { fixed: 1, one_off: 2 } as const;
  const KIND_ORDER = { income: 1, saving: 2, expense: 3 } as const;

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
  const KIND_ORDER = { income: 1, saving: 2, expense: 3 } as const;

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

/**
 * Builds data for transaction view mode with transactions nested under their parent envelopes.
 * Structure: Group Header → Envelope → Nested Transactions → Free Transactions
 */
export function buildNestedTransactionViewData(params: {
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
    envelopes.sort((a, b) => compareBudgetLines(a, b));

    // Count items for header (envelopes + free transactions, not nested)
    const itemCount = envelopes.length + freeTxs.length;

    // Add group header
    result.push({
      metadata: {
        itemType: 'group_header',
        groupKind: kind,
        groupLabel: GROUP_LABELS[kind],
        groupIcon: KIND_ICONS[kind],
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

      // Add nested transactions (sorted by date desc, then name)
      const nestedTxs = allocatedByEnvelope.get(envelope.id) ?? [];
      nestedTxs
        .sort((a, b) => compareTransactions(a, b))
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
              kindIcon: getKindIcon(tx.kind),
              allocationLabel: getAllocationLabel(tx.kind),
              rolloverSourceBudgetId: undefined,
            },
          } satisfies TransactionTableItem);
        });
    });

    // Add free transactions (sorted)
    freeTxs
      .sort((a, b) => compareTransactions(a, b))
      .forEach((tx) => {
        // Free transactions impact balance
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
