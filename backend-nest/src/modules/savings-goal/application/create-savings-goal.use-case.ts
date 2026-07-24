import { Inject, Injectable } from '@nestjs/common';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  type SavingsGoalCreate,
} from 'pulpe-shared';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '@modules/budget-template/domain/ports/budget-template-repository.port';
import {
  TEMPLATE_LINE_PROPAGATION_PORT,
  type TemplateLinePropagationPort,
} from '@modules/budget-template/domain/ports/template-line-propagation.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoal } from '../domain/savings-goal.entity';

@Injectable()
export class CreateSavingsGoalUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: BudgetTemplateRepositoryPort,
    @Inject(TEMPLATE_LINE_PROPAGATION_PORT)
    private readonly templateLinePropagation: TemplateLinePropagationPort,
    @InjectInfoLogger(CreateSavingsGoalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: SavingsGoalCreate,
    user: AuthenticatedUser,
  ): Promise<SavingsGoal> {
    const entity = await this.repo.insert({
      name: dto.name,
      targetAmount: dto.targetAmount,
      targetDate: dto.targetDate,
      status: dto.status ?? 'ACTIVE',
      originalTargetAmount: dto.originalTargetAmount ?? null,
      originalCurrency: dto.originalCurrency ?? null,
      targetCurrency: dto.targetCurrency ?? null,
      exchangeRate: dto.exchangeRate ?? null,
      initialAmount: dto.initialAmount ?? null,
    });

    let baselineCreated = false;
    if (dto.monthlyContribution != null) {
      baselineCreated = await this.generateLinkedBaseline(
        entity,
        dto.monthlyContribution,
        user,
      );
    }

    this.logger.info(
      {
        savingsGoalId: entity.id,
        userId: user.id,
        operation: 'savingsGoal.create',
        autoDecompose: dto.monthlyContribution != null,
        baselineCreated,
      },
      'Savings goal created',
    );

    return entity;
  }

  /**
   * PUL-285 CA1/CA2 — auto-décomposition : pose la prévision Épargne
   * récurrente liée sur le Mois Type par défaut et la propage aux budgets
   * matérialisés (RG-001), jusqu'à la période d'échéance incluse (PUL-311 —
   * la mensualité couvre `monthsRemaining`, propager au-delà sur-engagerait
   * l'utilisateur). Une création de ligne échouée reste best-effort car
   * l'objectif est déjà committé. Si la ligne a elle aussi été committée mais
   * que le recalcul échoue, un code dédié prévient le client de rafraîchir sans
   * recréer l'objectif.
   */
  private async generateLinkedBaseline(
    goal: SavingsGoal,
    monthlyContribution: number,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    try {
      const templateId = await this.templateRepo.findDefaultTemplateId(user.id);
      if (!templateId) {
        this.logger.warn(
          {
            operation: 'savingsGoal.autoDecompose',
            userId: user.id,
            savingsGoalId: goal.id,
          },
          'No default template — goal created without its linked baseline',
        );
        return false;
      }
      const payDayOfMonth = await this.repo.findPayDayOfMonth();
      await this.templateLinePropagation.createLineAndPropagate({
        templateId,
        userId: user.id,
        name: goal.name,
        amount: monthlyContribution,
        kind: 'saving',
        recurrence: 'fixed',
        savingsGoalId: goal.id,
        maxPeriod: getBudgetPeriodForDate(
          parseIsoDateLocal(goal.targetDate),
          payDayOfMonth,
        ),
      });
      return true;
    } catch (err) {
      this.rethrowCommittedBaselineFailure(err, goal.id, user.id);
      this.logger.warn(
        {
          operation: 'savingsGoal.autoDecompose',
          userId: user.id,
          savingsGoalId: goal.id,
          err,
        },
        'Linked baseline generation failed — goal created without it',
      );
      return false;
    }
  }

  private rethrowCommittedBaselineFailure(
    error: unknown,
    savingsGoalId: string,
    userId: string,
  ): void {
    if (
      !(error instanceof BusinessException) ||
      error.loggingContext.partialFailure !== true
    ) {
      return;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_BASELINE_RECALCULATION_FAILED,
      undefined,
      {
        operation: 'savingsGoal.autoDecompose.recalcAfterCommit',
        severity: 'critical',
        partialFailure: true,
        affectedBudgetIds: error.loggingContext.affectedBudgetIds,
        userId,
        savingsGoalId,
      },
      { cause: error },
    );
  }
}
