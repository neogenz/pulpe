import type { BudgetLine, BudgetPeriod, BudgetSparse } from "pulpe-shared";
import { periodFromIndex, periodIndex } from "pulpe-shared";

/**
 * Port of `BudgetLine.isPostponeEligible` (`ios/Pulpe/Domain/Models/BudgetLine.swift`),
 * itself the client half of the refusals `postpone-budget-line.use-case.ts`
 * raises. None of them ever becomes true by trying again, so offering the action
 * and then answering "Réessaie" is what this replaces.
 *
 * The allocation count is a parameter because a line does not carry its own
 * transactions; whether the target month exists is a budget-wide question, and
 * `hasBudgetForPeriod` answers that one separately — it is the only refusal the
 * user can lift, which is why it stays visible instead of hiding the entry.
 */
export function isPostponeEligible(
  line: BudgetLine,
  allocatedTransactionCount: number,
): boolean {
  return (
    line.checkedAt === null &&
    line.recurrence === "one_off" &&
    line.isRollover !== true &&
    line.spreadGroupId == null &&
    line.savingsWithdrawalGroupId == null &&
    allocatedTransactionCount === 0
  );
}

/** The month a report lands in — always the next calendar one. */
export function postponeTargetPeriod(period: BudgetPeriod): BudgetPeriod {
  return periodFromIndex(periodIndex(period) + 1);
}

export function hasBudgetForPeriod(
  budgets: BudgetSparse[],
  period: BudgetPeriod,
): boolean {
  return budgets.some(
    (budget) => budget.year === period.year && budget.month === period.month,
  );
}
