import type { BudgetCreate, BudgetDeletionImpact } from 'pulpe-shared';
import type { Budget } from '../budget.entity';

export const BUDGET_WRITE_PORT = Symbol('BUDGET_WRITE_PORT');

/**
 * Create or delete the budget of a month, for in-process consumers (the MCP
 * agent connector). Requires the caller to have put `user` and `supabase` in
 * CLS, exactly like an HTTP request does.
 */
export interface BudgetWritePort {
  createFromTemplate(dto: BudgetCreate): Promise<Budget>;
  /** What deleting this month takes with it. Refuses the current and past months. */
  deletionImpact(month: number, year: number): Promise<BudgetDeletionImpact>;
  /** Deletes the month and returns what went with it. */
  removeMonth(
    month: number,
    year: number,
    confirmLinks: boolean,
  ): Promise<BudgetDeletionImpact>;
}
