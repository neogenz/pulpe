import type { Database } from './database.types';

// Types helper pour simplifier l'utilisation
export type TableRows<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Types spécifiques pour vos entités avec noms explicites
export type TransactionRow = TableRows<'transaction'>;
export type TransactionInsert = InsertDto<'transaction'>;
export type TransactionUpdate = UpdateDto<'transaction'>;

export type BudgetRow = TableRows<'monthly_budget'>;
export type BudgetInsert = InsertDto<'monthly_budget'>;
export type BudgetUpdate = UpdateDto<'monthly_budget'>;

export type BudgetTemplateRow = TableRows<'template'>;
export type BudgetTemplateInsert = InsertDto<'template'>;
export type BudgetTemplateUpdate = UpdateDto<'template'>;

export type TemplateTransactionRow = TableRows<'template_line'>;
export type TemplateTransactionInsert = InsertDto<'template_line'>;
export type TemplateTransactionUpdate = UpdateDto<'template_line'>;

// Types d'énumérations
export type ExpenseType = Database['public']['Enums']['expense_type'];
export type TransactionType = Database['public']['Enums']['transaction_type'];

// Type pour le client Supabase typé
export type SupabaseClient =
  import('@supabase/supabase-js').SupabaseClient<Database>;
