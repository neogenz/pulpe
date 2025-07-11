import type { Database, Enums } from '../../../types/database.types';

// Types Supabase (snake_case) - backend uniquement
export type TransactionRow = Database['public']['Tables']['transaction']['Row'];
export type TransactionInsert =
  Database['public']['Tables']['transaction']['Insert'];

// Types des enums
export type ExpenseType = Enums<'expense_type'>;
export type TransactionType = Enums<'transaction_type'>;

// Constantes de validation
export const TRANSACTION_CONSTANTS = {
  MAX_AMOUNT: 1000000,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  CURRENCY: 'CHF', // Configuration locale (fr-CH)
} as const;
