import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineUpdate, type BudgetLineResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import { mapCurrencyMetadataToDb } from '@common/utils/currency-metadata.mapper';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineInvariants } from '../domain/budget-line.invariants';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';
import type { Database } from '../../../types/database.types';

@Injectable()
export class UpdateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(UpdateBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: BudgetLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    BudgetLineInvariants.validateUpdate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);
    let updateData = this.prepareUpdateData(withRate);

    if (withRate.amount !== undefined) {
      const { amount } = await this.encryptionService.prepareAmountData(
        withRate.amount,
        user.id,
        user.clientKey,
      );
      updateData = { ...updateData, amount };
    }

    if (withRate.originalAmount !== undefined) {
      updateData.original_amount =
        await this.encryptionService.encryptOptionalAmount(
          withRate.originalAmount,
          user.id,
          user.clientKey,
        );
    }

    const row = await this.repo.update(id, updateData, supabase);
    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = this.encryptionService.decryptRowAmountFields(row, dek);

    await this.budgetRecalculation.recalculate(
      row.budget_id,
      supabase,
      user.clientKey,
    );
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { budgetLineId: id, userId: user.id, operation: 'budgetLine.update' },
      'Budget line updated',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }

  private prepareUpdateData(dto: BudgetLineUpdate): Record<string, unknown> {
    return {
      ...(dto.name && { name: dto.name }),
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.templateLineId !== undefined && {
        template_line_id: dto.templateLineId,
      }),
      ...(dto.savingsGoalId !== undefined && {
        savings_goal_id: dto.savingsGoalId,
      }),
      ...(dto.kind !== undefined && {
        kind: dto.kind as Database['public']['Enums']['transaction_kind'],
      }),
      ...(dto.recurrence !== undefined && { recurrence: dto.recurrence }),
      ...(dto.isManuallyAdjusted !== undefined && {
        is_manually_adjusted: dto.isManuallyAdjusted,
      }),
      ...mapCurrencyMetadataToDb(dto),
      updated_at: new Date().toISOString(),
    };
  }
}
