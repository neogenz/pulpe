import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionListResponse } from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CacheService } from '@modules/cache/cache.service';
import * as transactionMappers from '@modules/transaction/transaction.mappers';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';

@Injectable()
export class CheckTransactionsUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(CheckTransactionsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    const rows = await this.repo.checkUncheckedTransactionsRpc(id, supabase);
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypted = rows.map((row) =>
      this.encryption.decryptRowAmountFields(row, dek),
    );

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: id,
        userId: user.id,
        count: decrypted.length,
        operation: 'budgetLine.checkTransactions',
      },
      'Transactions checked',
    );

    return {
      success: true,
      data: transactionMappers.toApiList(decrypted),
    };
  }
}
