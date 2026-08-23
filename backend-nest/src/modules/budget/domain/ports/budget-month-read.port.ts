import type { BudgetWithDetails } from '../budget.entity';

export const BUDGET_MONTH_READ_PORT = Symbol('BUDGET_MONTH_READ_PORT');

/**
 * Read one month's budget with its lines and movements, for in-process
 * consumers (the MCP agent connector). Requires the caller to have put
 * `user` and `supabase` in CLS, exactly like an HTTP request does.
 */
export interface BudgetMonthReadPort {
  /** `null` when the user has no budget for that period. */
  readMonth(month: number, year: number): Promise<BudgetWithDetails | null>;
}
