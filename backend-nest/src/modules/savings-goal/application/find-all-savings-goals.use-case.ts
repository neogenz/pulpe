import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type { SavingsGoal } from '../domain/savings-goal.entity';

@Injectable()
export class FindAllSavingsGoalsUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(FindAllSavingsGoalsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<SavingsGoal[]> {
    const entities = await this.repo.findAll();

    this.logger.info(
      {
        userId: user.id,
        count: entities.length,
        operation: 'savingsGoal.findAll',
      },
      'Savings goals fetched',
    );

    return entities;
  }
}
