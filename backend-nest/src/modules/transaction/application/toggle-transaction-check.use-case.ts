import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import type { Transaction } from '../domain/transaction.entity';

@Injectable()
export class ToggleTransactionCheckUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(ToggleTransactionCheckUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<Transaction> {
    const entity = await this.repo.toggleCheck(id);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        transactionId: id,
        userId: user.id,
        newCheckedAt: entity.checkedAt,
        operation: 'transaction.toggleCheck',
      },
      'Transaction check state toggled',
    );

    return entity;
  }
}
