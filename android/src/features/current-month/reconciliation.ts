import type { ReconciliationVerdict, TransactionCreate } from "pulpe-shared";

/** Never a saving: the gap came in or went out, it was not set aside. */
export type ReconciliationAdjustment = Exclude<
  ReconciliationVerdict,
  { kind: "upToDate" }
>;

/**
 * One checked, free entry on the budget the reconciliation was opened on.
 * Stamped now on both sides: the adjustment is a fact of today, already seen.
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
