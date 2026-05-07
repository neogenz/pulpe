import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { Tables } from '../../../../types/database.types';

export const DEMO_REPOSITORY = Symbol('DEMO_REPOSITORY');

type TemplateRow = Tables<'template'>;
type BudgetRow = Tables<'monthly_budget'>;

type TemplateInsert = Omit<TemplateRow, 'id' | 'created_at' | 'updated_at'>;
type TemplateLineInsert = Omit<
  Tables<'template_line'>,
  'id' | 'created_at' | 'updated_at'
>;
type MonthlyBudgetInsert = Omit<BudgetRow, 'id' | 'created_at' | 'updated_at'>;
type BudgetLineInsert = Omit<
  Tables<'budget_line'>,
  'id' | 'created_at' | 'updated_at'
>;
type TransactionInsert = Omit<
  Tables<'transaction'>,
  'id' | 'created_at' | 'updated_at'
>;

export type {
  TemplateRow,
  BudgetRow,
  TemplateInsert,
  TemplateLineInsert,
  MonthlyBudgetInsert,
  BudgetLineInsert,
  TransactionInsert,
};

export interface DemoRepositoryPort {
  insertTemplates(
    rows: TemplateInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow[]>;
  insertTemplateLines(
    rows: TemplateLineInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]>;
  insertBudgets(
    rows: MonthlyBudgetInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow[]>;
  insertBudgetLines(
    rows: BudgetLineInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
  insertTransactions(
    rows: TransactionInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
}
