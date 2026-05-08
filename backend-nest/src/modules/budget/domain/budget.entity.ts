import type { Database } from '../../../types/database.types';

export type BudgetRow = Database['public']['Tables']['monthly_budget']['Row'];
export type BudgetInsert =
  Database['public']['Tables']['monthly_budget']['Insert'];
export type BudgetUpdate =
  Database['public']['Tables']['monthly_budget']['Update'];
export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
export type TransactionRow = Database['public']['Tables']['transaction']['Row'];

type TransactionKind = Database['public']['Enums']['transaction_kind'];
type TransactionRecurrence =
  Database['public']['Enums']['transaction_recurrence'];

export interface BudgetAggregates {
  totalExpenses: number;
  totalSavings: number;
  totalIncome: number;
}

/**
 * Domain entity for a monthly budget — camelCase, decrypted plain numbers.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to API DTOs.
 */
export interface Budget {
  id: string;
  userId: string | null;
  templateId: string;
  month: number;
  year: number;
  description: string;
  endingBalance: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lightweight budget shape used for rollover computation.
 * `endingBalance` is decrypted by the repo before return.
 */
export interface BudgetForRollover {
  id: string;
  month: number;
  year: number;
  endingBalance: number | null;
}

/**
 * Repo write patch for partial updates.
 */
export interface BudgetUpdatePatch {
  month?: number;
  year?: number;
  description?: string;
  templateId?: string;
}

/**
 * Composite read result for a single budget plus its decrypted lines + transactions.
 * Used by `find-budget-with-details`, `export-all-budgets`, and `recalculate-budget-balances`.
 */
export interface BudgetWithRelations {
  budget: Budget;
  budgetLines: BudgetLineDecrypted[];
  transactions: TransactionDecrypted[];
}

/**
 * Inline minimal entity for a decrypted budget_line row, kept here to avoid a
 * cross-module compile-time dependency from budget/domain/ to budget-line/domain/.
 * Mirrors the canonical `BudgetLine` entity in the budget-line module.
 */
export interface BudgetLineDecrypted {
  id: string;
  budgetId: string;
  templateLineId: string | null;
  savingsGoalId: string | null;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  isManuallyAdjusted: boolean;
  checkedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Inline minimal entity for a decrypted transaction row. See `BudgetLineDecrypted`
 * comment for rationale.
 */
export interface TransactionDecrypted {
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
