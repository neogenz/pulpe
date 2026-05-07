import type { Database } from '../../../types/database.types';

export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
export type BudgetLineInsert =
  Database['public']['Tables']['budget_line']['Insert'];
export type BudgetLineUpdate =
  Database['public']['Tables']['budget_line']['Update'];
export type TemplateLineRow =
  Database['public']['Tables']['template_line']['Row'];
export type TransactionRow = Database['public']['Tables']['transaction']['Row'];
