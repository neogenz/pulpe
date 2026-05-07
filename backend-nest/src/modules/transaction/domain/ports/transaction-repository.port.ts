import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type {
  TransactionRow,
  TransactionInsert,
  TransactionUpdate,
} from '../transaction.entity';

export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');

export interface TransactionRepositoryPort {
  findAll(supabase: AuthenticatedSupabaseClient): Promise<TransactionRow[]>;
  findById(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow>;
  findByBudgetId(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow[]>;
  findByBudgetLineId(
    budgetLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow[]>;
  insert(
    data: TransactionInsert,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow>;
  update(
    id: string,
    data: Partial<TransactionUpdate>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow>;
  delete(id: string, supabase: AuthenticatedSupabaseClient): Promise<void>;
  fetchBudgetIdForTransaction(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string>;
  fetchBudgetLineForAllocation(
    budgetLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ id: string; budget_id: string; kind: string } | null>;
  assertBudgetLineExists(
    budgetLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
  fetchBudgetIdsByYears(
    userId: string,
    years: number[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]>;
  fetchTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<
    {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      transaction_date: string;
      category: string | null;
      budget_id: string;
      budget: unknown;
    }[]
  >;
  fetchBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<
    {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      recurrence: 'fixed' | 'one_off';
      budget_id: string;
      budget: unknown;
    }[]
  >;
}
