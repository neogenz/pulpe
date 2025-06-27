import type { Database } from './database.types';

// Types helper pour simplifier l'utilisation
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

// Types spécifiques pour vos entités avec noms explicites
export type TransactionRow = Tables<'transactions'>;
export type TransactionInsert = InsertDto<'transactions'>;
export type TransactionUpdate = UpdateDto<'transactions'>;

export type BudgetRow = Tables<'budgets'>;
export type BudgetInsert = InsertDto<'budgets'>;
export type BudgetUpdate = UpdateDto<'budgets'>;

export type BudgetTemplateRow = Tables<'budget_templates'>;
export type BudgetTemplateInsert = InsertDto<'budget_templates'>;
export type BudgetTemplateUpdate = UpdateDto<'budget_templates'>;

export type TemplateTransactionRow = Tables<'template_transactions'>;
export type TemplateTransactionInsert = InsertDto<'template_transactions'>;
export type TemplateTransactionUpdate = UpdateDto<'template_transactions'>;

// Types d'énumérations
export type ExpenseType = Database['public']['Enums']['expense_type'];
export type TransactionType = Database['public']['Enums']['transaction_type'];

// Type pour le client Supabase typé
export type SupabaseClient =
  import('@supabase/supabase-js').SupabaseClient<Database>;
