import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import type { Transaction } from '../domain/transaction.entity';

@Injectable()
export class FindAllTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @InjectInfoLogger(FindAllTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<Transaction[]> {
    const entities = await this.repo.findAll();

    this.logger.info(
      {
        userId: user.id,
        count: entities.length,
        operation: 'transaction.findAll',
      },
      'Transactions fetched',
    );

    return entities;
  }
}
