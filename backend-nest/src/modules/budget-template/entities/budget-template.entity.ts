import type { Tables, TablesInsert } from '../../../types/database.types';

// Types Supabase (snake_case) - backend uniquement
export type BudgetTemplateRow = Tables<'template'>;
export type BudgetTemplateInsert = TablesInsert<'template'>;

// Constantes de validation
export const BUDGET_TEMPLATE_CONSTANTS = {
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  CATEGORY_MAX_LENGTH: 50,
} as const;
