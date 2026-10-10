import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';

/**
 * Whether the account has recorded anything yet (PUL-306). Clients use it to
 * invite the first expense and to tell the first entry apart from the others,
 * whichever device recorded it.
 */
@Injectable()
export class HasTransactionsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @InjectInfoLogger(HasTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(user: AuthenticatedUser): Promise<boolean> {
    const result = await this.repo.hasAnyTransaction();

    this.logger.info(
      {
        userId: user.id,
        hasTransactions: result,
        operation: 'transaction.hasTransactions',
      },
      'Transaction existence checked',
    );

    return result;
  }
}
