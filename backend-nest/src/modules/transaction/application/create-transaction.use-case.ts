import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type TransactionCreate,
  type TransactionResponse,
  type TransactionKind,
} from 'pulpe-shared';
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
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import { TransactionInvariants } from '../domain/transaction.invariants';
import { TransactionMapper } from '../infrastructure/mappers/transaction.mapper';
import type { Database } from '../../../types/database.types';

type TransactionKindEnum = Database['public']['Enums']['transaction_kind'];

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly mapper: TransactionMapper,
    @InjectInfoLogger(CreateTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: TransactionCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    TransactionInvariants.validateCreate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);

    if (withRate.budgetLineId) {
      await this.validateBudgetLineAllocation(
        withRate.budgetLineId,
        withRate.budgetId,
        withRate.kind,
      );
    }

    const baseData = this.prepareInsertData(withRate);

    const [{ amount }, encryptedOriginalAmount] = await Promise.all([
      this.encryption.prepareAmountData(
        withRate.amount,
        user.id,
        user.clientKey,
      ),
      this.encryption.encryptOptionalAmount(
        withRate.originalAmount,
        user.id,
        user.clientKey,
      ),
    ]);

    const row = await this.repo.insert({
      ...baseData,
      amount,
      original_amount: encryptedOriginalAmount,
    });

    await this.budgetRecalculation.recalculate(
      row.budget_id,
      supabase,
      user.clientKey,
    );

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        transactionId: row.id,
        userId: user.id,
        operation: 'transaction.create',
      },
      'Transaction created',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }

  private async validateBudgetLineAllocation(
    budgetLineId: string,
    budgetId: string,
    transactionKind: TransactionKind,
  ): Promise<void> {
    const budgetLine =
      await this.repo.fetchBudgetLineForAllocation(budgetLineId);

    if (!budgetLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'validateBudgetLineAllocation',
          entityId: budgetLineId,
          entityType: 'budget_line',
        },
      );
    }

    if (budgetLine.budget_id !== budgetId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Transaction budget must match budget line budget' },
      );
    }

    if (budgetLine.kind !== transactionKind) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Transaction kind must match budget line kind (expected: ${budgetLine.kind}, got: ${transactionKind})`,
        },
      );
    }
  }

  private prepareInsertData(dto: TransactionCreate) {
    return {
      ...(dto.id ? { id: dto.id } : {}),
      budget_id: dto.budgetId,
      budget_line_id: dto.budgetLineId ?? null,
      amount: dto.amount,
      name: dto.name,
      kind: dto.kind as TransactionKindEnum,
      transaction_date: dto.transactionDate || new Date().toISOString(),
      category: dto.category ?? null,
      checked_at: dto.checkedAt ?? null,
      ...mapCurrencyMetadataToDb(dto),
    };
  }
}
