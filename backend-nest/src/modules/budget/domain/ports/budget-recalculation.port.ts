import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

export const BUDGET_RECALCULATION_PORT = Symbol('BUDGET_RECALCULATION_PORT');

export interface BudgetRecalculationPort {
  /**
   * Recalculate ending_balance for a budget after budget_line/transaction mutations.
   * Used by budget-line, transaction, budget-template modules.
   */
  recalculate(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer,
  ): Promise<void>;
}
