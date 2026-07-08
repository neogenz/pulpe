import type {
  SavingsGoal,
  SavingsGoalContribution,
  SavingsGoalCreateInput,
  SavingsGoalLinkedContributions,
  SavingsGoalPlanApplyResult,
  SavingsGoalPlanMonthAdjustment,
  SavingsGoalPlanTemplateAdjustment,
  SavingsGoalUpdatePatch,
} from '../savings-goal.entity';

export const SAVINGS_GOAL_REPOSITORY = Symbol('SAVINGS_GOAL_REPOSITORY');

export interface SavingsGoalRepositoryPort {
  findAll(): Promise<SavingsGoal[]>;
  findById(id: string): Promise<SavingsGoal>;
  insert(input: SavingsGoalCreateInput): Promise<SavingsGoal>;
  update(id: string, patch: SavingsGoalUpdatePatch): Promise<SavingsGoal>;
  delete(id: string): Promise<void>;
  /**
   * Prévisions Épargne liées au goal (kind=saving, RLS-scoped, décryptées)
   * avec leur période budgétaire + les transactions qui leur sont allouées
   * (PUL-8 — progression).
   */
  findLinkedContributions(
    goalId: string,
  ): Promise<SavingsGoalLinkedContributions>;
  /**
   * Contributions à un objectif (PUL-12) : une par prévision Épargne liée
   * (kind=saving, RLS-scopée), avec la période de son budget parent et les
   * transactions qui lui sont allouées (déchiffrées, triées transaction_date
   * décroissant). Les lignes sont triées chronologiquement croissant.
   */
  findContributions(goalId: string): Promise<SavingsGoalContribution[]>;
  /**
   * payDayOfMonth de l'utilisateur authentifié (borné 1-31), ou null pour le
   * comportement calendaire standard. Lu depuis `auth.users.user_metadata`.
   */
  findPayDayOfMonth(): Promise<number | null>;
  /**
   * Applique un plan simulé (PUL-12) via la RPC atomique `apply_savings_goal_plan`.
   * Chiffre chaque montant, écrit les prévisions liées non pointées du cycle
   * courant ou futur (`is_manually_adjusted = true`) et les lignes du Mois Type
   * ciblées. Tout écart de garde → RAISE → rollback total (rien de partiel). Le
   * repo possède le chiffrement + le mapping des erreurs P0001.
   */
  applyPlan(
    goalId: string,
    monthAdjustments: SavingsGoalPlanMonthAdjustment[],
    templateAdjustments: SavingsGoalPlanTemplateAdjustment[],
    minPeriodIndex: number,
  ): Promise<SavingsGoalPlanApplyResult>;
}
