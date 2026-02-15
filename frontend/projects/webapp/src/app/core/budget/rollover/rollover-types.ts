import type { BudgetLine } from 'pulpe-shared';
import { format } from 'date-fns';
import { frCH } from 'date-fns/locale';

/**
 * Represents a virtual rollover line for display purposes
 * This is a budget line enriched with rollover-specific properties
 */
type RolloverLine = BudgetLine & {
  /** Indicates this is a virtual rollover line */
  isRollover: true;
  /** Budget ID of the source month for navigation */
  rolloverSourceBudgetId?: string;
};

const ROLLOVER_PATTERN = /rollover_(\d+)_(\d+)/;

export function formatRolloverDisplayName(name: string): string {
  if (!name?.startsWith('rollover_')) {
    return name;
  }

  const match = name.match(ROLLOVER_PATTERN);
  if (!match) {
    return name;
  }

  const [, month, year] = match;
  const monthIndex = parseInt(month, 10) - 1;

  if (monthIndex < 0 || monthIndex >= 12) {
    return name;
  }

  const date = new Date(parseInt(year, 10), monthIndex, 1);
  const monthName = format(date, 'MMMM', { locale: frCH });

  return `Report ${monthName} ${year}`;
}

/**
 * Type guard to check if a budget line is a rollover line
 */
export function isRolloverLine(item: unknown): item is RolloverLine {
  return (
    item !== null &&
    item !== undefined &&
    typeof item === 'object' &&
    'isRollover' in item &&
    (item as Record<string, unknown>)['isRollover'] === true
  );
}

/**
 * Creates a virtual rollover line for display
 */
export function createRolloverLine(params: {
  budgetId: string;
  amount: number;
  month: number;
  year: number;
  previousBudgetId?: string | null;
}): RolloverLine {
  const prevMonth = params.month === 1 ? 12 : params.month - 1;
  const prevYear = params.month === 1 ? params.year - 1 : params.year;

  return {
    id: 'rollover-display',
    budgetId: params.budgetId,
    templateLineId: null,
    savingsGoalId: null,
    name: `rollover_${prevMonth}_${prevYear}`,
    amount: Math.abs(params.amount),
    kind: params.amount > 0 ? 'income' : 'expense',
    recurrence: 'fixed',
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isRollover: true as const,
    rolloverSourceBudgetId: params.previousBudgetId ?? undefined,
  };
}
