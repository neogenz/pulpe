import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionListResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';

@Injectable()
export class FindTransactionsByBudgetLineUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly mapper: TransactionMapper,
    @InjectInfoLogger(FindTransactionsByBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    budgetLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    await this.repo.assertBudgetLineExists(budgetLineId, supabase);

    const rows = await this.repo.findByBudgetLineId(budgetLineId, supabase);
    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = rows.map((row) =>
      this.encryptionService.decryptRowAmountFields(row, dek),
    );

    this.logger.info(
      {
        budgetLineId,
        userId: user.id,
        count: decrypted.length,
        operation: 'transaction.findByBudgetLine',
      },
      'Transactions by budget line fetched',
    );

    return { success: true as const, data: this.mapper.toApiList(decrypted) };
  }
}
