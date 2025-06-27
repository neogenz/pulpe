import type { Tables } from '../../../types/database.types';

// Source unique de vérité : Types Supabase (snake_case)
export type BudgetTemplateRow = Tables<'budget_templates'>;

// Constantes de validation
export const BUDGET_TEMPLATE_CONSTANTS = {
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  CATEGORY_MAX_LENGTH: 50,
} as const;
