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
  /** PUL-17: groupe des prévisions sœurs d'une dépense lissée. null = non lissée. */
  spreadGroupId: string | null;
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
 * Decrypted spread SOURCE: a budget_line plus its budget's month/year (M0),
 * the fields the total-preserving spread-from flow needs to validate eligibility
 * and redistribute the total (PUL-17 v1.1). Fetched in one join so the use case
 * stays I/O-free.
 */
export interface SpreadSourceLine {
  id: string;
  budgetId: string;
  month: number;
  year: number;
  name: string;
  amount: number;
  originalAmount: number | null;
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
  kind: TransactionKind;
  recurrence: TransactionRecurrence;
  spreadGroupId: string | null;
}

/**
 * One occurrence of a spread group across its months (PUL-17 Lot C, read-only).
 * Cross-budget projection: budget_line fields (decrypted) + its budget's month/year.
 */
export interface SpreadOccurrence {
  budgetLineId: string;
  budgetId: string;
  month: number;
  year: number;
  name: string;
  amount: number;
  /** Σ of this occurrence's allocated transactions (decrypted), 0 if none. */
  consumed: number;
  /** Number of allocated transactions — lets the client pick consumed vs prévu. */
  transactionCount: number;
  originalAmount: number | null;
  originalCurrency: SupportedCurrency | null;
  targetCurrency: SupportedCurrency | null;
  exchangeRate: number | null;
  kind: TransactionKind;
  checkedAt: string | null;
}

/**
 * PUL-17 v1.1 (Defect 2): the source entity to delete ATOMICALLY inside the
 * `create_budget_lines_spread` RPC (same all-or-nothing transaction as the
 * fan-out insert). The discriminated `type` selects which guarded RPC delete
 * runs — the additive create flow passes no source at all.
 */
export type SpreadDeleteSource =
  | { type: 'budget_line'; id: string }
  | { type: 'transaction'; id: string };

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
