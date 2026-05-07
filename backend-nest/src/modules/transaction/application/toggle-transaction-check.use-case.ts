import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';

@Injectable()
export class ToggleTransactionCheckUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: CacheService,
    private readonly mapper: TransactionMapper,
    @InjectInfoLogger(ToggleTransactionCheckUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    const current = await this.repo.findById(id, supabase);

    const newCheckedAt =
      current.checked_at === null ? new Date().toISOString() : null;

    const row = await this.repo.update(
      id,
      { checked_at: newCheckedAt, updated_at: new Date().toISOString() },
      supabase,
    );

    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = this.encryptionService.decryptRowAmountFields(row, dek);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        transactionId: id,
        userId: user.id,
        newCheckedAt,
        operation: 'transaction.toggleCheck',
      },
      'Transaction check state toggled',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }
}
