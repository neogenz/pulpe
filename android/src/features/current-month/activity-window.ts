import type { Transaction } from "pulpe-shared";

export type ActivityWindow = "week" | "month";

const WINDOW_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Per-window cap. The week is a chronological prefix of the month, so one cap
 * for both rendered identical lists as soon as five operations fell inside
 * seven days — and the selector then looked broken.
 */
const MAX_ROWS: Record<ActivityWindow, number> = { week: 5, month: 10 };

export interface ActivityDay {
  /** Start of the day, as a key and a sort handle. */
  date: Date;
  transactions: Transaction[];
}

export interface ActivitySummary {
  days: ActivityDay[];
  /** Arithmetic net of the window: income positive, everything else negative. */
  net: number;
}

/**
 * The window's rows, capped and bucketed by day, newest first. The cap applies
 * before the grouping, so the card shows at most `MAX_ROWS` operations however
 * many days they land on — but the net covers the whole window, capped or not,
 * because a total that silently ignored the eleventh operation would be wrong.
 */
export function summarizeActivity(
  transactions: Transaction[],
  window: ActivityWindow,
  now: Date,
): ActivitySummary {
  const windowed = [...transactions]
    .filter((transaction) => isInWindow(transaction, window, now))
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  return {
    days: groupByDay(windowed.slice(0, MAX_ROWS[window])),
    net: windowed.reduce(
      (total, transaction) =>
        total +
        (transaction.kind === "income"
          ? transaction.amount
          : -transaction.amount),
      0,
    ),
  };
}

function isInWindow(
  transaction: Transaction,
  window: ActivityWindow,
  now: Date,
): boolean {
  if (window === "month") return true;
  const cutoff = now.getTime() - WINDOW_DAYS * MILLISECONDS_PER_DAY;
  return new Date(transaction.transactionDate).getTime() >= cutoff;
}

function groupByDay(transactions: Transaction[]): ActivityDay[] {
  const days: ActivityDay[] = [];

  for (const transaction of transactions) {
    const date = startOfDay(new Date(transaction.transactionDate));
    const open = days[days.length - 1];
    if (open !== undefined && open.date.getTime() === date.getTime()) {
      open.transactions.push(transaction);
      continue;
    }
    days.push({
      date,
      transactions: [transaction],
    });
  }

  return days;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
