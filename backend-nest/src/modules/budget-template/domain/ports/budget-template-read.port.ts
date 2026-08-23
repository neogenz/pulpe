import type { BudgetTemplate } from '../budget-template.entity';

export const BUDGET_TEMPLATE_READ_PORT = Symbol('BUDGET_TEMPLATE_READ_PORT');

/**
 * Read the user's month models, for in-process consumers (the MCP agent
 * connector). Requires the caller to have put `user` and `supabase` in CLS,
 * exactly like an HTTP request does.
 */
export interface BudgetTemplateReadPort {
  list(): Promise<BudgetTemplate[]>;
}
