import type { BudgetCreate } from 'pulpe-shared';
import type { Budget } from '../budget.entity';

export const BUDGET_WRITE_PORT = Symbol('BUDGET_WRITE_PORT');

/**
 * Create the budget of a month from a template, for in-process consumers (the
 * MCP agent connector). Requires the caller to have put `user` and `supabase`
 * in CLS, exactly like an HTTP request does.
 */
export interface BudgetWritePort {
  createFromTemplate(dto: BudgetCreate): Promise<Budget>;
}
