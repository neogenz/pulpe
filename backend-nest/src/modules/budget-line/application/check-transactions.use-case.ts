import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { BudgetLineCheckTransactionsPort } from '../domain/ports/budget-line-allocation.port';
import type { BudgetLineCheckedTransaction } from '../domain/budget-line.entity';

@Injectable()
export class CheckTransactionsUseCase implements BudgetLineCheckTransactionsPort {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(CheckTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<BudgetLineCheckedTransaction[]> {
    await this.repo.validateAccess(id, user.id);
    const entities = await this.repo.checkUncheckedTransactionsRpc(id);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: id,
        userId: user.id,
        count: entities.length,
        operation: 'budgetLine.checkTransactions',
      },
      'Transactions checked',
    );

    return entities;
  }
}
