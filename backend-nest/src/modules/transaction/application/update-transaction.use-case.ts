import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type TransactionUpdate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionInvariants } from '../domain/transaction.invariants';
import type { Transaction } from '../domain/transaction.entity';

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(UpdateTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: TransactionUpdate,
    user: AuthenticatedUser,
  ): Promise<Transaction> {
    TransactionInvariants.validateUpdate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);

    const entity = await this.repo.update(id, {
      ...(withRate.amount !== undefined && { amount: withRate.amount }),
      ...(withRate.name !== undefined && { name: withRate.name }),
      ...(withRate.kind !== undefined && { kind: withRate.kind }),
      ...(withRate.transactionDate !== undefined && {
        transactionDate: withRate.transactionDate,
      }),
      ...(withRate.category !== undefined && { category: withRate.category }),
      ...(withRate.originalAmount !== undefined && {
        originalAmount: withRate.originalAmount,
      }),
      ...(withRate.originalCurrency !== undefined && {
        originalCurrency: withRate.originalCurrency,
      }),
      ...(withRate.targetCurrency !== undefined && {
        targetCurrency: withRate.targetCurrency,
      }),
      ...(withRate.exchangeRate !== undefined && {
        exchangeRate: withRate.exchangeRate,
      }),
    });

    await this.budgetRecalculation.recalculate(entity.budgetId, user.clientKey);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.update' },
      'Transaction updated',
    );

    return entity;
  }
}
