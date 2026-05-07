import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineCreate, type BudgetLineResponse } from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { BudgetService } from '@modules/budget/budget.service';
import { mapCurrencyMetadataToDb } from '@common/utils/currency-metadata.mapper';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineInvariants } from '../domain/budget-line.invariants';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';
import type { Database } from '../../../types/database.types';

@Injectable()
export class CreateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    private readonly budgetService: BudgetService,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(CreateBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetLineCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    BudgetLineInvariants.validateCreate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);
    const baseData = this.prepareInsertData(withRate);

    const [{ amount }, encryptedOriginalAmount] = await Promise.all([
      this.encryptionService.prepareAmountData(
        baseData.amount as number,
        user.id,
        user.clientKey,
      ),
      this.encryptionService.encryptOptionalAmount(
        withRate.originalAmount,
        user.id,
        user.clientKey,
      ),
    ]);

    const row = await this.repo.insert(
      { ...baseData, amount, original_amount: encryptedOriginalAmount },
      supabase,
    );

    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decrypted = this.encryptionService.decryptRowAmountFields(row, dek);

    await this.budgetService.recalculateBalances(
      row.budget_id,
      supabase,
      user.clientKey,
    );
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      { budgetLineId: row.id, userId: user.id, operation: 'budgetLine.create' },
      'Budget line created',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }

  private prepareInsertData(dto: BudgetLineCreate) {
    return {
      ...(dto.id ? { id: dto.id } : {}),
      budget_id: dto.budgetId!,
      template_line_id: dto.templateLineId ?? null,
      savings_goal_id: dto.savingsGoalId ?? null,
      name: dto.name,
      amount: dto.amount,
      kind: dto.kind as Database['public']['Enums']['transaction_kind'],
      recurrence: dto.recurrence,
      is_manually_adjusted: dto.isManuallyAdjusted ?? false,
      checked_at: dto.checkedAt ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...mapCurrencyMetadataToDb(dto),
    };
  }
}
