import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type {
  BudgetLineRow,
  BudgetLineInsert,
  BudgetLineUpdate,
  TemplateLineRow,
  TransactionRow,
} from '../budget-line.entity';

export const BUDGET_LINE_REPOSITORY = Symbol('BUDGET_LINE_REPOSITORY');

export interface BudgetLineRepositoryPort {
  findAll(supabase: AuthenticatedSupabaseClient): Promise<BudgetLineRow[]>;
  findById(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow>;
  findByBudgetId(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow[]>;
  fetchBudgetIdForLine(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string | null>;
  insert(
    data: BudgetLineInsert,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow>;
  update(
    id: string,
    data: Partial<BudgetLineUpdate>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow>;
  delete(id: string, supabase: AuthenticatedSupabaseClient): Promise<void>;
  fetchTemplateLineById(
    templateLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow>;
  toggleCheckRpc(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow>;
  checkUncheckedTransactionsRpc(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow[]>;
}
