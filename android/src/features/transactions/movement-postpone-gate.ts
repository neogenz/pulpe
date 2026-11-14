import type { Transaction } from "pulpe-shared";

/**
 * Port of `MovementSheet.postponeAction`: only a free (no forecast) and
 * unpointed movement can move to next month. The month existing is a separate
 * question, answered by `hasBudgetForPeriod`.
 */
export function isMovementPostponeEligible(transaction: Transaction): boolean {
  return transaction.budgetLineId === null && transaction.checkedAt === null;
}
