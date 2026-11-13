import {
  BudgetFormulas,
  type BudgetLine,
  type Transaction,
} from "pulpe-shared";

const CENTIMES_PER_UNIT = 100;

export type ImpactTone = "neutral" | "over" | "ok";

/** What an action does to the month's « disponible », before the user validates. */
export interface DisponibleImpact {
  before: number;
  after: number;
  /** after - before, to the centime. */
  delta: number;
  /** `over` when the action lowers it, `ok` when it raises it. */
  tone: ImpactTone;
}

export interface MonthLedger {
  lines: BudgetLine[];
  transactions: Transaction[];
  rollover: number;
}

function remaining({ lines, transactions, rollover }: MonthLedger): number {
  return BudgetFormulas.calculateAllMetrics(lines, transactions, rollover)
    .remaining;
}

/** The month as it is, then as it would be: `MovementImpact.between`. */
export function impactBetween(
  before: MonthLedger,
  after: MonthLedger,
): DisponibleImpact {
  const figures = { before: remaining(before), after: remaining(after) };
  const delta =
    Math.round((figures.after - figures.before) * CENTIMES_PER_UNIT) /
    CENTIMES_PER_UNIT;
  return {
    ...figures,
    delta,
    tone: delta === 0 ? "neutral" : delta < 0 ? "over" : "ok",
  };
}

/**
 * Taking one prévision out of the month: its movements stay, Hors prévision —
 * `BudgetDataStore.impactOfRemoving`.
 */
export function impactOfRemoving(
  ledger: MonthLedger,
  lineId: string,
): DisponibleImpact {
  const lines = ledger.lines.filter((line) => line.id !== lineId);
  const transactions = ledger.transactions.map((transaction) =>
    transaction.budgetLineId === lineId
      ? { ...transaction, budgetLineId: null }
      : transaction,
  );
  return impactBetween(ledger, { ...ledger, lines, transactions });
}

/** The same month with one prévision planned at another amount. */
export function replacingAmount(
  ledger: MonthLedger,
  lineId: string,
  amount: number,
): MonthLedger {
  return {
    ...ledger,
    lines: ledger.lines.map((line) =>
      line.id === lineId ? { ...line, amount } : line,
    ),
  };
}
