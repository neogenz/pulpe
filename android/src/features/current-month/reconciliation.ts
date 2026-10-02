import { moneyDifference, type TransactionCreate } from "pulpe-shared";

/**
 * A bank balance as typed: an optional minus (an overdraft), at most nine
 * digits of units and two of cents. Anything else is refused rather than read
 * as zero — `parseAmount` in `core/ui/money` drops the sign and reads "12," as
 * 12, which is right for a form amount and wrong for an account held against
 * the ledger to the cent.
 */
const ACCOUNT_AMOUNT_PATTERN = /^(-?)(\d{1,9})(?:[.,](\d{1,2}))?$/;
/** Pasted from a banking app, an overdraft often carries the typographic minus. */
const TYPOGRAPHIC_MINUS = /−/g;
const CENTS_PER_UNIT = 100;

export type AccountAmount =
  | { status: "blank" }
  | { status: "invalid" }
  | { status: "valid"; cents: number };

/** Integer cents, read from the digits so a sum of accounts never drifts. */
export function parseAccountAmount(text: string): AccountAmount {
  const normalized = text.trim().replace(TYPOGRAPHIC_MINUS, "-");
  if (normalized === "") return { status: "blank" };

  const match = ACCOUNT_AMOUNT_PATTERN.exec(normalized);
  if (match === null) return { status: "invalid" };

  const [, sign, units, decimals = ""] = match;
  const magnitude =
    Number(units) * CENTS_PER_UNIT + Number(decimals.padEnd(2, "0"));
  return { status: "valid", cents: sign === "-" ? -magnitude : magnitude };
}

export interface AccountsSummary {
  /** `null` until every typed amount reads, so no total is ever partial. */
  totalCents: number | null;
  canContinue: boolean;
}

/**
 * Blank rows are skipped, but one unreadable amount withholds the whole total:
 * summing around it would reconcile against a figure nobody typed.
 */
export function summarizeAccounts(
  amountTexts: readonly string[],
): AccountsSummary {
  let totalCents = 0;
  let validCount = 0;
  for (const text of amountTexts) {
    const amount = parseAccountAmount(text);
    if (amount.status === "invalid") {
      return { totalCents: null, canContinue: false };
    }
    if (amount.status === "valid") {
      totalCents += amount.cents;
      validCount += 1;
    }
  }
  return validCount === 0
    ? { totalCents: null, canContinue: false }
    : { totalCents, canContinue: true };
}

/** Never a saving: the gap came in or went out, it was not set aside. */
export type ReconciliationAdjustment = {
  kind: "income" | "expense";
  amount: number;
};

export type ReconciliationVerdict =
  | { kind: "upToDate" }
  | ReconciliationAdjustment;

/** Settled in cents on both sides, with no tolerance. */
export function reconciliationVerdict(
  totalCents: number,
  realizedBalance: number,
): ReconciliationVerdict {
  const gap = moneyDifference(totalCents / CENTS_PER_UNIT, realizedBalance);
  if (gap === 0) return { kind: "upToDate" };
  return gap > 0
    ? { kind: "income", amount: gap }
    : { kind: "expense", amount: -gap };
}

/**
 * One checked, free entry on the budget the home screen has loaded. Stamped
 * now on both sides: the adjustment is a fact of today, already seen.
 */
export function buildAdjustmentPayload(input: {
  budgetId: string;
  name: string;
  adjustment: ReconciliationAdjustment;
  now: Date;
}): TransactionCreate {
  const stamp = input.now.toISOString();
  return {
    budgetId: input.budgetId,
    name: input.name.trim(),
    amount: input.adjustment.amount,
    kind: input.adjustment.kind,
    transactionDate: stamp,
    checkedAt: stamp,
  };
}
