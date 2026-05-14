import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import type { Transaction } from '../domain/transaction.entity';

@Injectable()
export class FindTransactionsByBudgetLineUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @InjectInfoLogger(FindTransactionsByBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetLineId: string,
    user: AuthenticatedUser,
  ): Promise<Transaction[]> {
    await this.repo.assertBudgetLineExists(budgetLineId);

    const entities = await this.repo.findByBudgetLineId(budgetLineId);

    this.logger.info(
      {
        budgetLineId,
        userId: user.id,
        count: entities.length,
        operation: 'transaction.findByBudgetLine',
      },
      'Transactions by budget line fetched',
    );

    return entities;
  }
}
