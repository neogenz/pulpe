import type {
  TransactionKind,
  TransactionRecurrence,
  BudgetLine,
} from 'pulpe-shared';

export const KIND_ICONS: Record<TransactionKind, string> = {
  income: 'arrow_upward',
  expense: 'arrow_downward',
  saving: 'savings',
} as const;

export const ALLOCATION_LABELS: Record<TransactionKind, string> = {
  expense: 'Saisir une dépense',
  income: 'Saisir un revenu',
  saving: 'Saisir une épargne',
} as const;

export const TRANSACTION_COUNT_LABELS: Record<TransactionKind, string> = {
  expense: 'dépense',
  income: 'revenu',
  saving: 'épargne',
} as const;

export const GROUP_LABELS: Record<TransactionKind, string> = {
  income: 'Revenu',
  saving: 'Épargne',
  expense: 'Dépense',
} as const;

export const RECURRENCE_ORDER: Record<TransactionRecurrence, number> = {
  fixed: 1,
  one_off: 2,
} as const;

export const KIND_ORDER: Record<TransactionKind, number> = {
  income: 1,
  saving: 2,
  expense: 3,
} as const;

export function getKindIcon(kind: TransactionKind): string {
  return KIND_ICONS[kind] ?? 'help';
}

export function getAllocationLabel(kind: TransactionKind): string {
  return ALLOCATION_LABELS[kind] ?? 'Saisir';
}

export function getTransactionCountLabel(
  kind: TransactionKind,
  count: number,
): string {
  const label = TRANSACTION_COUNT_LABELS[kind] ?? 'transaction';
  return `${count} ${label}${count > 1 ? 's' : ''}`;
}

export function calculatePercentage(
  reserved: number,
  consumed: number,
): number {
  if (reserved <= 0) return 0;
  return Math.round((consumed / reserved) * 100);
}

export function getRolloverSourceBudgetId(
  data: BudgetLine,
): string | undefined {
  return 'rolloverSourceBudgetId' in data
    ? (data as BudgetLine & { rolloverSourceBudgetId?: string })
        .rolloverSourceBudgetId
    : undefined;
}

export function getSignedAmount(kind: TransactionKind, amount: number): number {
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

export function safeParseDate(value: string | null | undefined): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return Number.MAX_SAFE_INTEGER;
  return timestamp;
}
