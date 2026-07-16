import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type SavingsGoalCreate } from 'pulpe-shared';
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
   * matérialisés (RG-001). Best-effort : l'objectif est déjà committé, donc un
   * échec ici ne fait pas échouer la création — un retry client dupliquerait
   * l'objectif ; l'utilisateur peut lier la ligne à la main.
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
      await this.templateLinePropagation.createLineAndPropagate({
        templateId,
        userId: user.id,
        name: goal.name,
        amount: monthlyContribution,
        kind: 'saving',
        recurrence: 'fixed',
        savingsGoalId: goal.id,
      });
      return true;
    } catch (err) {
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
}
