import type { BudgetWithDetails } from '../budget.entity';

export const BUDGET_MONTH_READ_PORT = Symbol('BUDGET_MONTH_READ_PORT');

/** One month seen from the outside: the five totals the app puts on screen. */
export interface BudgetMonthSummary {
  readonly id: string;
  readonly month: number;
  readonly year: number;
  readonly totalIncome: number;
  readonly totalExpenses: number;
  readonly totalSavings: number;
  readonly rollover: number;
  readonly remaining: number;
}

/**
 * Read the user's budget months with their lines and movements, for in-process
 * consumers (the MCP agent connector). Requires the caller to have put
 * `user` and `supabase` in CLS, exactly like an HTTP request does.
 */
export interface BudgetMonthReadPort {
  /** `null` when the user has no budget for that period. */
  readMonth(month: number, year: number): Promise<BudgetWithDetails | null>;
  /** Newest months first, totals included. */
  listMonths(limit: number): Promise<BudgetMonthSummary[]>;
}
