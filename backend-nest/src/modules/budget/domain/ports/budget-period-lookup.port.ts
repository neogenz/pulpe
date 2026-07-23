export const BUDGET_PERIOD_LOOKUP_PORT = Symbol('BUDGET_PERIOD_LOOKUP_PORT');

export interface BudgetPeriod {
  month: number;
  year: number;
}

export interface BudgetPeriodLookupPort {
  /**
   * Resolve the id of the user's budget for the month immediately following the
   * given source budget (handles the December → January year rollover).
   * Returns `null` when that month has no budget yet.
   */
  findNextMonthBudgetId(
    sourceBudgetId: string,
    userId: string,
  ): Promise<string | null>;
  /**
   * Resolve the `{month, year}` immediately following the given source budget
   * (same December → January rollover), regardless of whether that month has a
   * budget yet — the caller provisions it if needed (PUL-292). Throws NOT_FOUND
   * when the source budget does not exist or is not the user's.
   */
  findNextMonthPeriod(
    sourceBudgetId: string,
    userId: string,
  ): Promise<BudgetPeriod>;
}
