import type { SupportedCurrency } from 'pulpe-shared';
import type { Database } from '../../../types/database.types';

export type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
export type BudgetLineInsert =
  Database['public']['Tables']['budget_line']['Insert'];
export type BudgetLineUpdate =
  Database['public']['Tables']['budget_line']['Update'];
export type TransactionRow = Database['public']['Tables']['transaction']['Row'];

type TransactionKind = Database['public']['Enums']['transaction_kind'];
type TransactionRecurrence =
  Database['public']['Enums']['transaction_recurrence'];

/**
 * Domain entity for a budget line — camelCase, decrypted plain numbers.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to API DTOs.
 */
export interface BudgetLine {
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
 * Repo write input for inserts. Plain numbers — repo encrypts internally.
 */
export interface BudgetLineCreateInput {
  id?: string;
  budgetId: string;
  templateLineId?: string | null;
  savingsGoalId?: string | null;
  name: string;
  amount: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  isManuallyAdjusted?: boolean;
  checkedAt?: string | null;
}

/**
 * Repo write patch for partial updates. Plain numbers — repo encrypts internally.
 *
 * Currency metadata fields use `undefined` to mean "do not touch", `null` to mean "clear".
 */
export interface BudgetLineUpdatePatch {
  name?: string;
  amount?: number;
  originalAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  kind?: TransactionKind;
  recurrence?: TransactionRecurrence;
  templateLineId?: string | null;
  savingsGoalId?: string | null;
  isManuallyAdjusted?: boolean;
  checkedAt?: string | null;
}

export type { TemplateLine } from '../../budget-template/domain/budget-template.entity';
