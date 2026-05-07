import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';

@Injectable()
export class FindTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly mapper: TransactionMapper,
    @InjectInfoLogger(FindTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    const row = await this.repo.findById(id, supabase);
    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = this.encryptionService.decryptRowAmountFields(row, dek);

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.findOne' },
      'Transaction fetched',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }
}
