import type {
  LinkedSavingLine,
  LinkedSavingTransaction,
  SavingsGoalProgressResult,
  SupportedCurrency,
} from 'pulpe-shared';
import type { Database } from '../../../types/database.types';

export type SavingsGoalRow =
  Database['public']['Tables']['savings_goal']['Row'];
export type SavingsGoalInsert =
  Database['public']['Tables']['savings_goal']['Insert'];

type SavingsGoalStatus = Database['public']['Enums']['savings_goal_status'];

/**
 * Domain entity for a savings goal — camelCase, decrypted plain numbers.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to API DTOs.
 * `targetAmount` / `originalTargetAmount` are decrypted (the DB stores AES-256-GCM
 * ciphertext text in `target_amount` / `original_target_amount`).
 */
export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  targetDate: string;
  status: SavingsGoalStatus;
  createdAt: string;
  updatedAt: string;
  originalTargetAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
}

/**
 * Repo write input for inserts. Plain numbers — repo encrypts internally.
 */
export interface SavingsGoalCreateInput {
  name: string;
  targetAmount: number;
  targetDate: string;
  status: SavingsGoalStatus;
  originalTargetAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
}

/**
 * Repo write patch for partial updates. Plain numbers — repo encrypts internally.
 *
 * Currency metadata fields use `undefined` to mean "do not touch", `null` to mean "clear".
 */
export interface SavingsGoalUpdatePatch {
  name?: string;
  targetAmount?: number;
  targetDate?: string;
  status?: SavingsGoalStatus;
  originalTargetAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
}

/**
 * Read model for progress (PUL-8): the prévisions Épargne linked to a goal
 * (with their budget period) and the transactions allocated to them.
 * Amounts are decrypted plain numbers — repo decrypts internally.
 */
export interface SavingsGoalLinkedContributions {
  lines: LinkedSavingLine[];
  transactions: LinkedSavingTransaction[];
}

/**
 * Use-case result for progress — the goal plus the computed formulas.
 * The mapper assembles the API DTO at the controller boundary.
 */
export interface SavingsGoalProgressComputation {
  goal: SavingsGoal;
  computed: SavingsGoalProgressResult;
}
