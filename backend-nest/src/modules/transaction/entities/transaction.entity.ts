import type {
  Tables,
  TablesInsert,
  Enums,
} from '../../../types/database.types';

// Types Supabase (snake_case) - backend uniquement
export type TransactionRow = Tables<'transactions'>;
export type TransactionInsert = TablesInsert<'transactions'>;

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
