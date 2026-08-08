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
  SavingsGoalPlanWithdrawalAdjustment,
  SavingsGoalTargetDateReconciliationCommand,
  SavingsGoalTargetDateReconciliationResult,
  SavingsGoalUpdatePatch,
  SavingsGoalBalanceInputs,
  SavingsGoalWithdrawalRecord,
  SavingsGoalPlannedWithdrawalRecord,
} from '../savings-goal.entity';
import type {
  BudgetPeriod,
  LinkedPlannedWithdrawal,
  LinkedSavingLine,
  LinkedSavingWithdrawal,
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
    planWithdrawalAdjustments?: SavingsGoalPlanWithdrawalAdjustment[],
    expectedRevision?: number,
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
  /**
   * Retraits liés à un objectif (PUL-329), déchiffrés, situés sur la PÉRIODE de
   * leur budget porteur — pas sur leur date de saisie. C'est cette période qui
   * place la sortie dans la chronologie du plan, comme pour les contributions.
   */
  findLinkedWithdrawals(goalId: string): Promise<LinkedSavingWithdrawal[]>;
  /**
   * Retraits ANNONCÉS : les prévisions `income` qui disent « ce montant sortira
   * de cet objectif ». Séparé de `findLinkedWithdrawals` parce que la nature
   * l'est : celles-ci n'ont pas encore touché le stock et ne le toucheront
   * peut-être jamais. Elles n'abaissent que la projection.
   */
  findPlannedWithdrawals(goalId: string): Promise<LinkedPlannedWithdrawal[]>;
  /** Retraits directs du plan, sans Prévision Revenu ni budget. */
  findPlanWithdrawals(goalId: string): Promise<LinkedPlannedWithdrawal[]>;
  /**
   * Historique présentable d'un objectif, trié du plus récent au plus ancien.
   * Sépare de `findLinkedWithdrawals` : la chronologie du plan a besoin de la
   * période budgétaire, la liste affichée a besoin du libellé et de la date.
   */
  findWithdrawals(goalId: string): Promise<SavingsGoalWithdrawalRecord[]>;
  /** Prévisions Revenu présentables, avant agrégation avec leurs Réels. */
  findPlannedWithdrawalRecords(
    goalId: string,
  ): Promise<SavingsGoalPlannedWithdrawalRecord[]>;
  /**
   * De quoi calculer le solde de TOUS les objectifs de l'utilisateur, en une
   * lecture groupée : le sélecteur d'origine ouvre la liste entière d'un coup,
   * et un aller-retour par objectif serait un N+1 sur le chemin le plus
   * interactif de la feature.
   *
   * Le repository rend la matière brute déchiffrée ; c'est l'appelant qui
   * applique `computeSavingsGoalProgress`. Un solde n'est pas une donnée
   * stockée mais le résultat d'une formule, et il n'en existe qu'une.
   */
  findAllBalanceInputs(): Promise<SavingsGoalBalanceInputs[]>;
  /**
   * Révision de solde d'UN objectif. `null` = objectif inexistant ou étranger :
   * l'appelant décide s'il refuse en 404 ou en 422, le repository ne présume
   * pas du parcours.
   *
   * À lire AVANT les lignes, transactions et retraits dont elle certifie la
   * fraîcheur, jamais en parallèle : toute écriture concurrente incrémente la
   * révision, donc une révision lue en premier ne peut que devenir périmée —
   * la RPC refuse alors l'écriture. Lue en dernier, elle pourrait au contraire
   * certifier un solde déjà dépassé, et l'écriture passerait.
   */
  findBalanceRevision(goalId: string): Promise<number | null>;
}
