import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import type { Transaction } from '../domain/transaction.entity';

@Injectable()
export class FindTransactionsByBudgetUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @InjectInfoLogger(FindTransactionsByBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
  ): Promise<Transaction[]> {
    const entities = await this.repo.findByBudgetId(budgetId);

    this.logger.info(
      {
        budgetId,
        userId: user.id,
        count: entities.length,
        operation: 'transaction.findByBudget',
      },
      'Transactions by budget fetched',
    );

    return entities;
  }
}
