import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type TransactionUpdate, type TransactionResponse } from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import { mapCurrencyMetadataToDb } from '@common/utils/currency-metadata.mapper';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionInvariants } from '../domain/transaction.invariants';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';
import type { Database } from '../../../types/database.types';

type TransactionKindEnum = Database['public']['Enums']['transaction_kind'];

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly mapper: TransactionMapper,
    @InjectInfoLogger(UpdateTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: TransactionUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    TransactionInvariants.validateUpdate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);
    let updateData = this.prepareUpdateData(withRate);

    if (withRate.amount !== undefined) {
      const { amount } = await this.encryption.prepareAmountData(
        withRate.amount,
        user.id,
        user.clientKey,
      );
      updateData = { ...updateData, amount };
    }

    if (withRate.originalAmount !== undefined) {
      updateData.original_amount = await this.encryption.encryptOptionalAmount(
        withRate.originalAmount,
        user.id,
        user.clientKey,
      );
    }

    const row = await this.repo.update(id, updateData, supabase);

    await this.budgetRecalculation.recalculate(
      row.budget_id,
      supabase,
      user.clientKey,
    );

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { transactionId: id, userId: user.id, operation: 'transaction.update' },
      'Transaction updated',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }

  private prepareUpdateData(dto: TransactionUpdate): Record<string, unknown> {
    return {
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.name && { name: dto.name }),
      ...(dto.kind !== undefined && {
        kind: dto.kind as TransactionKindEnum,
      }),
      ...(dto.transactionDate !== undefined && {
        transaction_date: dto.transactionDate,
      }),
      ...(dto.category !== undefined && { category: dto.category }),
      ...mapCurrencyMetadataToDb(dto),
      updated_at: new Date().toISOString(),
    };
  }
}
