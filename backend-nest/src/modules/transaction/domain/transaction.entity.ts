import type { SupportedCurrency } from 'pulpe-shared';
import type { Database } from '../../../types/database.types';

export type TransactionRow = Database['public']['Tables']['transaction']['Row'];
export type TransactionInsert =
  Database['public']['Tables']['transaction']['Insert'];
export type TransactionUpdate =
  Database['public']['Tables']['transaction']['Update'];

type TransactionKind = Database['public']['Enums']['transaction_kind'];

/**
 * Domain entity for a transaction — camelCase, decrypted plain numbers.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to API DTOs.
 */
export interface Transaction {
  id: string;
  budgetId: string;
  budgetLineId: string | null;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
  kind: TransactionKind;
  category: string | null;
  transactionDate: string;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repo write input for inserts. Plain numbers — repo encrypts internally.
 */
export interface TransactionCreateInput {
  id?: string;
  budgetId: string;
  budgetLineId?: string | null;
  name: string;
  amount: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind: TransactionKind;
  category?: string | null;
  transactionDate: string;
  checkedAt?: string | null;
}

/**
 * Repo write patch for partial updates. Plain numbers — repo encrypts internally.
 *
 * Currency metadata fields use `undefined` to mean "do not touch", `null` to mean "clear".
 */
export interface TransactionUpdatePatch {
  name?: string;
  amount?: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind?: TransactionKind;
  category?: string | null;
  transactionDate?: string;
  checkedAt?: string | null;
}

/**
 * Decrypted budget_line lookup result for transaction allocation validation.
 */
export interface BudgetLineForAllocation {
  id: string;
  budgetId: string;
  kind: TransactionKind;
}

/**
 * Decrypted search result row (transaction or budget_line). Repo decrypts amount
 * before returning so use cases receive plain numbers.
 */
export interface TransactionSearchTransactionRow {
  id: string;
  name: string;
  amount: number;
  kind: string;
  transactionDate: string;
  category: string | null;
  budgetId: string;
  budget: { description: string; month: number; year: number } | null;
}

export interface TransactionSearchBudgetLineRow {
  id: string;
  name: string;
  amount: number;
  kind: string;
  recurrence: 'fixed' | 'one_off';
  budgetId: string;
  budget: { description: string; month: number; year: number } | null;
}
