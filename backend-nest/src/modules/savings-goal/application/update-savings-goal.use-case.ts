import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type SavingsGoalUpdate } from 'pulpe-shared';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalUpdatePatch,
} from '../domain/savings-goal.entity';

@Injectable()
export class UpdateSavingsGoalUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(UpdateSavingsGoalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: SavingsGoalUpdate,
    user: AuthenticatedUser,
  ): Promise<SavingsGoal> {
    const entity = await this.repo.update(id, this.buildPatch(dto));

    this.logger.info(
      { savingsGoalId: id, userId: user.id, operation: 'savingsGoal.update' },
      'Savings goal updated',
    );

    return entity;
  }

  private buildPatch(dto: SavingsGoalUpdate): SavingsGoalUpdatePatch {
    const patch: SavingsGoalUpdatePatch = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.targetAmount !== undefined) patch.targetAmount = dto.targetAmount;
    if (dto.targetDate !== undefined) patch.targetDate = dto.targetDate;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.originalTargetAmount !== undefined) {
      patch.originalTargetAmount = dto.originalTargetAmount;
    }
    if (dto.originalCurrency !== undefined) {
      patch.originalCurrency = dto.originalCurrency;
    }
    if (dto.targetCurrency !== undefined) {
      patch.targetCurrency = dto.targetCurrency;
    }
    if (dto.exchangeRate !== undefined) patch.exchangeRate = dto.exchangeRate;
    return patch;
  }
}
