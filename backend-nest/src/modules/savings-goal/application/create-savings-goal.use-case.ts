import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type SavingsGoalCreate } from 'pulpe-shared';
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

    this.logger.info(
      {
        savingsGoalId: entity.id,
        userId: user.id,
        operation: 'savingsGoal.create',
      },
      'Savings goal created',
    );

    return entity;
  }
}
