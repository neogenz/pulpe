import type {
  SavingsGoal,
  SavingsGoalContribution,
  SavingsGoalCreateInput,
  SavingsGoalDeletionImpactResult,
  SavingsGoalDeletionResult,
  SavingsGoalGenerationStopResult,
  SavingsGoalLinkedContributions,
  SavingsGoalPlanApplyResult,
  SavingsGoalPlanMonthAdjustment,
  SavingsGoalTargetDateReconciliationCommand,
  SavingsGoalTargetDateReconciliationResult,
  SavingsGoalUpdatePatch,
} from '../savings-goal.entity';
import type {
  BudgetPeriod,
  LinkedSavingLine,
  SavingsGoalDeletionCommand,
  SavingsGoalGenerationStop,
} from 'pulpe-shared';

export const SAVINGS_GOAL_REPOSITORY = Symbol('SAVINGS_GOAL_REPOSITORY');

export interface SavingsGoalRepositoryPort {
  findAll(): Promise<SavingsGoal[]>;
  findById(id: string): Promise<SavingsGoal>;
  insert(input: SavingsGoalCreateInput): Promise<SavingsGoal>;
  update(id: string, patch: SavingsGoalUpdatePatch): Promise<SavingsGoal>;
  delete(id: string): Promise<void>;
  getDeletionImpact(goalId: string): Promise<SavingsGoalDeletionImpactResult>;
  applyDeletion(
    goalId: string,
    command: SavingsGoalDeletionCommand,
  ): Promise<SavingsGoalDeletionResult>;
  /**
   * Prévisions Épargne liées au goal (kind=saving, RLS-scoped, décryptées)
   * avec leur période budgétaire + les transactions qui leur sont allouées
   * (PUL-8 — progression).
   */
  findLinkedContributions(
    goalId: string,
  ): Promise<SavingsGoalLinkedContributions>;
  /**
   * Prévisions Épargne liées au goal, déchiffrées, sans leurs transactions.
   * La qualification temporelle des lignes reste à la charge du use-case.
   */
  findLinkedSavingLines(goalId: string): Promise<LinkedSavingLine[]>;
  /**
   * Contributions à un objectif (PUL-12) : une par prévision Épargne liée
   * (kind=saving, RLS-scopée), avec la période de son budget parent et les
   * transactions qui lui sont allouées (déchiffrées, triées transaction_date
   * décroissant). Les lignes sont triées chronologiquement croissant.
   */
  findContributions(goalId: string): Promise<SavingsGoalContribution[]>;
  /** Périodes possédant déjà un budget pour l'utilisateur authentifié. */
  findMaterializedPeriods(): Promise<BudgetPeriod[]>;
  /**
   * Applique un plan simulé (PUL-12) via la RPC atomique `apply_savings_goal_plan`.
   * Chiffre chaque montant, écrit les prévisions liées non pointées du cycle
   * courant ou futur (`is_manually_adjusted = true`). Tout écart de garde
   * → RAISE → rollback total (rien de partiel). Le
   * repo possède le chiffrement + le mapping des erreurs P0001.
   */
  applyPlan(
    goalId: string,
    monthAdjustments: SavingsGoalPlanMonthAdjustment[],
    minPeriodIndex: number,
  ): Promise<SavingsGoalPlanApplyResult>;
  /**
   * Applique la décision advisory d'arrêt de génération (PUL-285 CA5) via la
   * RPC atomique `apply_savings_goal_generation_stop` : `freeze` délie +
   * protège (`is_manually_adjusted`), `remove` supprime. Gardes CA9 en WHERE
   * (non pointée, non ajustée, cycle courant ou futur) ; tout écart → RAISE →
   * rollback total. Le repo possède le mapping des erreurs P0001.
   */
  applyGenerationStop(
    goalId: string,
    mode: SavingsGoalGenerationStop['mode'],
    budgetLineIds: string[],
    minPeriodIndex: number,
  ): Promise<SavingsGoalGenerationStopResult>;
  reconcileTargetDate(
    goalId: string,
    command: SavingsGoalTargetDateReconciliationCommand,
  ): Promise<SavingsGoalTargetDateReconciliationResult>;
}
