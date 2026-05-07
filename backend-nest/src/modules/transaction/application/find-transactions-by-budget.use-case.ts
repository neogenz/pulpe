import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionListResponse } from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';

@Injectable()
export class FindTransactionsByBudgetUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly mapper: TransactionMapper,
    @InjectInfoLogger(FindTransactionsByBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    const rows = await this.repo.findByBudgetId(budgetId, supabase);
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypted = rows.map((row) =>
      this.encryption.decryptRowAmountFields(row, dek),
    );

    this.logger.info(
      {
        budgetId,
        userId: user.id,
        count: decrypted.length,
        operation: 'transaction.findByBudget',
      },
      'Transactions by budget fetched',
    );

    return { success: true as const, data: this.mapper.toApiList(decrypted) };
  }
}
