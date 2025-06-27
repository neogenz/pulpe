import type { Tables, Enums } from '../../../types/database.types';

// Source unique de vérité : Types Supabase
export type Transaction = Tables<'transactions'>;

// Types des enums
export type ExpenseType = Enums<'expense_type'>;
export type TransactionType = Enums<'transaction_type'>;

// Constantes de validation
export const TRANSACTION_CONSTANTS = {
  MAX_AMOUNT: 1000000,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
} as const;
