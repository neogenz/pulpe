import type { Budget } from '../budget.entity';

export const BUDGET_PROVISIONING_PORT = Symbol('BUDGET_PROVISIONING_PORT');

export interface SpreadPeriod {
  month: number;
  year: number;
}

export interface EnsureBudgetsResult {
  /** Key `${month}/${year}` → budgetId (existing or newly created). */
  budgetIdByPeriod: Map<string, string>;
  /** Budgets auto-created from the default template during this call. */
  createdBudgets: Budget[];
  /** Periods with no budget and no default template to create one from. */
  skippedMonths: SpreadPeriod[];
}

/**
 * Resolves a budgetId for each requested period, auto-creating the missing
 * `monthly_budget` rows from the user's default template (PUL-17 Lot A).
 *
 * Each creation is its OWN short transaction (idempotent — an existing period is
 * reused, never duplicated), intentionally kept OUTSIDE the spread fan-out's
 * atomic transaction so a fan-out rollback never discards already-created
 * budgets (`lock-short-transactions`). When `templateId` is null the missing
 * periods land in `skippedMonths` and receive no budget.
 */
export interface BudgetProvisioningPort {
  ensureBudgetsForPeriods(
    periods: SpreadPeriod[],
    templateId: string | null,
    userId: string,
  ): Promise<EnsureBudgetsResult>;
}
