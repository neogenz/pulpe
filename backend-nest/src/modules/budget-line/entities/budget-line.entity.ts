import type { Database } from '../../../types/database.types';

export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
export type BudgetLineInsert =
  Database['public']['Tables']['budget_line']['Insert'];
export type BudgetLineUpdate =
  Database['public']['Tables']['budget_line']['Update'];
