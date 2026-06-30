export const BUDGET_PERIOD_LOOKUP_PORT = Symbol('BUDGET_PERIOD_LOOKUP_PORT');

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
}
