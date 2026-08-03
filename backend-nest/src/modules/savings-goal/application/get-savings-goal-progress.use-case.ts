import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  buildSavingsGoalTimeline,
  computeSavingsGoalProgress,
  type BudgetPeriod,
  type LinkedSavingLine,
  type LinkedSavingTransaction,
  type LinkedSavingWithdrawal,
  type SavingsGoalProgressInput,
} from 'pulpe-shared';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '@modules/budget-template/domain/ports/budget-template-repository.port';
import type {
  SavingsGoal,
  SavingsGoalProgressComputation,
} from '../domain/savings-goal.entity';

/**
 * Progression d'un objectif (PUL-8 + PUL-12) — les 11 formules de docs/SAVINGS.md
 * §4 et §10.2 plus la timeline mensuelle (ancrage → cible).
 *
 * Le repo fournit la cible et les contributions DÉCHIFFRÉES ; le calcul est
 * payDay-aware via le payDayOfMonth de l'utilisateur. `computeSavingsGoalProgress`
 * et `buildSavingsGoalTimeline` partagent le MÊME input (lignes/transactions
 * déchiffrées + payDay). Tout est calculé côté serveur — le serveur reste seul
 * propriétaire des formules canoniques.
 */
@Injectable()
export class GetSavingsGoalProgressUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: BudgetTemplateRepositoryPort,
    @InjectInfoLogger(GetSavingsGoalProgressUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalProgressComputation> {
    // findById throws SAVINGS_GOAL_NOT_FOUND for a missing/foreign goal (RLS).
    const goal = await this.repo.findById(id);
    const [
      { lines, transactions },
      withdrawals,
      materializedPeriods,
      defaultTemplateId,
    ] = await Promise.all([
      this.repo.findLinkedContributions(id),
      this.repo.findLinkedWithdrawals(id),
      this.repo.findMaterializedPeriods(),
      this.templateRepo.findDefaultTemplateId(user.id),
    ]);
    const input = this.buildInput(goal, {
      payDayOfMonth: user.payDayOfMonth ?? null,
      materializedPeriods,
      hasDefaultTemplate: defaultTemplateId != null,
      lines,
      transactions,
      withdrawals,
    });

    const computed = computeSavingsGoalProgress(input);
    const months = buildSavingsGoalTimeline(input);

    this.logger.info(
      {
        savingsGoalId: id,
        userId: user.id,
        operation: 'savingsGoal.progress',
        linkedLineCount: computed.linkedLineCount,
      },
      'Savings goal progress computed',
    );

    return { goal, computed, months };
  }

  private buildInput(
    goal: SavingsGoal,
    data: {
      payDayOfMonth: number | null;
      materializedPeriods: BudgetPeriod[];
      hasDefaultTemplate: boolean;
      lines: LinkedSavingLine[];
      transactions: LinkedSavingTransaction[];
      withdrawals: LinkedSavingWithdrawal[];
    },
  ): SavingsGoalProgressInput {
    return {
      targetAmount: goal.targetAmount,
      status: goal.status,
      createdAt: goal.createdAt,
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      payDayOfMonth: data.payDayOfMonth,
      materializedPeriods: data.materializedPeriods,
      // PUL-316 — combler un trou ne recopie plus une ligne du Mois Type : il
      // crée la prévision liée directement. Seul le modèle par défaut reste
      // nécessaire, pour matérialiser le budget du mois absent — l'horizon
      // cible est vérifié par le calculateur lui-même (via targetDate), pas
      // ici : le conflater ANDait les deux et masquait un mois déjà
      // matérialisé quand l'objectif n'avait pas d'échéance.
      canProvisionMissingPeriods: data.hasDefaultTemplate,
      initialAmount: goal.initialAmount ?? 0,
      lines: data.lines,
      transactions: data.transactions,
      withdrawals: data.withdrawals,
    };
  }
}
