import type { Tables, TablesInsert } from '../../../types/database.types';

// Types Supabase (snake_case) - backend uniquement
export type BudgetRow = Tables<'budgets'>;
export type BudgetInsert = TablesInsert<'budgets'>;

// Constantes de validation
export const BUDGET_CONSTANTS = {
  CURRENT_YEAR: new Date().getFullYear(),
  MIN_YEAR: 2020,
  MAX_YEAR: new Date().getFullYear() + 10,
  MONTH_MIN: 1,
  MONTH_MAX: 12,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;
