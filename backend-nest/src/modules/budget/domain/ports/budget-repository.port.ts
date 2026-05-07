import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type {
  BudgetRow,
  BudgetLineRow,
  TransactionRow,
} from '../budget.entity';
import type { BudgetAggregates } from '../../infrastructure/persistence/supabase-budget.repository';

export const BUDGET_REPOSITORY = Symbol('BUDGET_REPOSITORY');

export interface BudgetDataOptions {
  budgetLineFields?: string;
  transactionFields?: string;
  includeBudget?: boolean;
  orderTransactions?: boolean;
}

export interface BudgetDataResult {
  budget?: BudgetRow;
  budgetLines: BudgetLineRow[];
  transactions: TransactionRow[];
}

export interface BudgetRepositoryPort {
  fetchBudgetById(
    id: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow>;
  fetchBudgetUserId(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string>;
  updateBudget(
    id: string,
    updateData: Record<string, unknown>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow>;
  deleteBudgetsByIds(
    ids: string[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<boolean>;
  getExistingPeriods(
    userId: string,
    targetMonths: { month: number; year: number }[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Set<string>>;
  fetchBudgetData(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    options?: BudgetDataOptions,
  ): Promise<BudgetDataResult>;
  fetchBudgetAggregates(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
    decryptFn: (amount: string | null) => number,
  ): Promise<Map<string, BudgetAggregates>>;
  hasAnyBudget(supabase: AuthenticatedSupabaseClient): Promise<boolean>;
  fetchAllBudgets(supabase: AuthenticatedSupabaseClient): Promise<BudgetRow[]>;
  fetchBudgetsWithFilters(
    filters: { limit?: number; year?: number },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow[]>;
  fetchAllBudgetsForExport(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow[]>;
  validateBudgetExists(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow>;
  deleteBudget(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
  createBudgetFromTemplateRpc(
    payload: {
      p_user_id: string;
      p_template_id: string;
      p_month: number;
      p_year: number;
      p_description: string;
    },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown>;
  persistEndingBalance(
    budgetId: string,
    encryptedBalance: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
  fetchAllBudgetsForRollover(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<
    { id: string; month: number; year: number; ending_balance: string | null }[]
  >;
}
