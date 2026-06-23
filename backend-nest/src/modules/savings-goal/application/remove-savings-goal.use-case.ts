import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';

@Injectable()
export class RemoveSavingsGoalUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @InjectInfoLogger(RemoveSavingsGoalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<void> {
    // The FK ON DELETE SET NULL unlinks tagged budget_line / template_line rows
    // atomically; no prévision is ever deleted (SAVINGS.md §9).
    await this.repo.delete(id);

    this.logger.info(
      { savingsGoalId: id, userId: user.id, operation: 'savingsGoal.remove' },
      'Savings goal deleted',
    );
  }
}
