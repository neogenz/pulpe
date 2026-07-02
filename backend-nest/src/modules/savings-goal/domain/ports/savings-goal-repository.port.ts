import type {
  SavingsGoal,
  SavingsGoalCreateInput,
  SavingsGoalLinkedContributions,
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
   * payDayOfMonth de l'utilisateur authentifié (borné 1-31), ou null pour le
   * comportement calendaire standard. Lu depuis `auth.users.user_metadata`.
   */
  findPayDayOfMonth(): Promise<number | null>;
}
