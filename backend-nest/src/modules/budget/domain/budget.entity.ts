import type { Database } from '../../../types/database.types';

export type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
export type BudgetInsert =
  Database['public']['Tables']['monthly_budget']['Insert'];
export type BudgetUpdate =
  Database['public']['Tables']['monthly_budget']['Update'];
export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
export type TransactionRow = Database['public']['Tables']['transaction']['Row'];
