import type { Transaction } from "pulpe-shared";

/** What the home keeps of the month: enough to see the last two days, not a ledger. */
const LATEST_COUNT = 5;

export interface ActivityDay {
  /** Start of the day, as a key and a sort handle. */
  date: Date;
  transactions: Transaction[];
}

/** Newest first, by the day the movement was noted. */
export function sortNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate),
  );
}

/** The latest few movements of the month. */
export function latestMovements(transactions: Transaction[]): Transaction[] {
  return sortNewestFirst(transactions).slice(0, LATEST_COUNT);
}

/** Buckets by day, newest day first; inside a day, the order given. */
export function groupByDay(transactions: Transaction[]): ActivityDay[] {
  const days: ActivityDay[] = [];

  for (const transaction of sortNewestFirst(transactions)) {
    const date = startOfDay(new Date(transaction.transactionDate));
    const open = days[days.length - 1];
    if (open !== undefined && open.date.getTime() === date.getTime()) {
      open.transactions.push(transaction);
      continue;
    }
    days.push({ date, transactions: [transaction] });
  }

  return days;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
