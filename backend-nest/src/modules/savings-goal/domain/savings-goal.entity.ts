import type {
  BudgetLine,
  LinkedSavingLine,
  LinkedSavingTransaction,
  LinkedSavingWithdrawal,
  SavingsGoalDeletionImpact,
  SavingsGoalPlanApply,
  SavingsGoalProgressResult,
  SavingsGoalReconciliation,
  SavingsGoalWithdrawal,
  SavingsGoalWithdrawalOption,
  SavingsPlanTimelineMonth,
  SupportedCurrency,
} from 'pulpe-shared';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';
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
  startDate: string | null;
  targetAmount: number | null;
  targetDate: string | null;
  status: SavingsGoalStatus;
  createdAt: string;
  updatedAt: string;
  originalTargetAmount: number | null;
  originalCurrency: string | null;
  targetCurrency: string | null;
  exchangeRate: number | null;
  /** Stock déjà épargné avant le suivi (PUL-293), déchiffré. */
  initialAmount: number | null;
}

/**
 * Repo write input for inserts. Plain numbers — repo encrypts internally.
 */
export interface SavingsGoalCreateInput {
  name: string;
  startDate: string | null;
  targetAmount: number | null;
  targetDate: string | null;
  status: SavingsGoalStatus;
  originalTargetAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  initialAmount?: number | null;
}

/**
 * Repo write patch for partial updates. Plain numbers — repo encrypts internally.
 *
 * Currency metadata fields use `undefined` to mean "do not touch", `null` to mean "clear".
 */
export interface SavingsGoalUpdatePatch {
  name?: string;
  startDate?: string | null;
  targetAmount?: number | null;
  targetDate?: string | null;
  status?: SavingsGoalStatus;
  originalTargetAmount?: number | null;
  originalCurrency?: SupportedCurrency | null;
  targetCurrency?: SupportedCurrency | null;
  exchangeRate?: number | null;
  initialAmount?: number | null;
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
 * Use-case result for progress — the goal, the computed formulas, and the
 * monthly timeline (ancrage → cible). `computed` carries formulas 1-11
 * (including `cumulativeGap` / `estimatedCompletion`); `months` is the
 * `buildSavingsGoalTimeline` output that feeds the trajectory chart and the
 * month-by-month plan (docs/SAVINGS.md §10.2). The mapper assembles the
 * API DTO at the controller boundary.
 */
export interface SavingsGoalProgressComputation {
  goal: SavingsGoal;
  computed: SavingsGoalProgressResult;
  months: SavingsPlanTimelineMonth[];
}

/**
 * A goal-linked saving prévision with its parent budget period and the
 * transactions allocated to it (PUL-12). Checking the prévision (`checkedAt`)
 * is a contribution WITHOUT a transaction — the tracking list is therefore
 * line-first, not transaction-first. Amounts are plain numbers — the repo
 * decrypts internally.
 */
export interface SavingsGoalContribution {
  lineId: string;
  name: string;
  amount: number;
  checkedAt: string | null;
  budgetMonth: number;
  budgetYear: number;
  transactions: Transaction[];
}

/** One line-scoped month adjustment of an applied plan (PUL-12, §4.3). */
export type SavingsGoalPlanMonthAdjustment =
  SavingsGoalPlanApply['monthAdjustments'][number];

/** Retrait direct signé : négatif = upsert, zéro = suppression. */
export type SavingsGoalPlanWithdrawalAdjustment = NonNullable<
  SavingsGoalPlanApply['planWithdrawalAdjustments']
>[number];

/**
 * Result of applying a plan (PUL-12). `updatedLines` are the decrypted budget
 * lines the RPC rewrote; `touchedBudgetIds` drives the post-commit recalc.
 */
export interface SavingsGoalPlanApplyResult {
  updatedLines: BudgetLine[];
  touchedBudgetIds: string[];
}

/**
 * Result of applying a generation-stop decision (PUL-285 CA5). `affectedLineIds`
 * are the frozen or removed budget lines; `touchedBudgetIds` drives the
 * post-commit recalc.
 */
export interface SavingsGoalGenerationStopResult {
  affectedLineIds: string[];
  touchedBudgetIds: string[];
}

export interface SavingsGoalTargetDateReconciliationCommand {
  patch: SavingsGoalUpdatePatch;
  reconciliation: {
    mode: SavingsGoalReconciliation['mode'];
    budgetLineIds: string[];
  };
  expectedTargetDate: string;
}

export interface SavingsGoalTargetDateReconciliationResult {
  goal: SavingsGoal;
  affectedLineIds: string[];
  touchedBudgetIds: string[];
}

/** Impact déchiffré présenté avant suppression (PUL-319). */
export type SavingsGoalDeletionImpactResult = SavingsGoalDeletionImpact;

/**
 * Un objectif proposable comme origine d'un revenu (PUL-329). Le serveur ne
 * renvoie que ceux dont le solde est strictement positif : le client choisit
 * dans une liste déjà filtrée et n'a aucun calcul d'éligibilité à refaire.
 */
export type SavingsGoalWithdrawalOptionResult = SavingsGoalWithdrawalOption;

/** Une sortie de stock déchiffrée, montant POSITIF (PUL-329). */
export type SavingsGoalWithdrawalRecord = SavingsGoalWithdrawal;

/** Prévision Revenu liée, déchiffrée, avant agrégation avec ses Réels. */
export interface SavingsGoalPlannedWithdrawalRecord {
  budgetLineId: string;
  budgetId: string;
  name: string;
  amount: number;
  month: number;
  year: number;
  origin?: 'plan_linked';
}

/**
 * Matière brute du solde d'un objectif (PUL-329) : tout ce que
 * `computeSavingsGoalProgress` réclame, et rien de plus. Le repository la lit
 * et la déchiffre, l'appelant applique la formule — un solde reste un calcul,
 * pas une colonne.
 */
export interface SavingsGoalBalanceInputs {
  goal: SavingsGoal;
  lines: LinkedSavingLine[];
  transactions: LinkedSavingTransaction[];
  withdrawals: LinkedSavingWithdrawal[];
}

/** Résultat DB de la suppression ; les budgets sont recalculés post-commit. */
export interface SavingsGoalDeletionResult {
  touchedBudgetIds: string[];
}
