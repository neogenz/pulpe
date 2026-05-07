import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { type BudgetLineResponse } from 'pulpe-shared';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineInvariants } from '../domain/budget-line.invariants';
import { BudgetLineMapper } from '../infrastructure/mappers/budget-line.mapper';
import type { TemplateLineRow } from '../domain/budget-line.entity';

@Injectable()
export class ResetBudgetLineFromTemplateUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly mapper: BudgetLineMapper,
    @InjectInfoLogger(ResetBudgetLineFromTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    const { encryptedAmount, resetData, budgetId } = await this.prepareReset(
      id,
      user,
      supabase,
    );

    const updated = await this.repo.update(
      id,
      { ...resetData, amount: encryptedAmount },
      supabase,
    );

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decrypted = this.encryption.decryptRowAmountFields(updated, dek);

    await this.budgetRecalculation.recalculate(
      budgetId,
      supabase,
      user.clientKey,
    );
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: id,
        userId: user.id,
        operation: 'budgetLine.resetFromTemplate',
      },
      'Budget line reset from template',
    );

    return { success: true, data: this.mapper.toApi(decrypted) };
  }

  private async prepareReset(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const budgetLine = await this.repo.findById(id, supabase);
    BudgetLineInvariants.validateTemplateLineIdExists(
      budgetLine.template_line_id,
    );

    const templateLine = await this.repo.fetchTemplateLineById(
      budgetLine.template_line_id!,
      supabase,
    );

    const templateAmount = await this.resolveTemplateAmount(templateLine, user);
    const { amount: encryptedAmount } = await this.encryption.prepareAmountData(
      templateAmount,
      user.id,
      user.clientKey,
    );

    return {
      encryptedAmount,
      resetData: this.buildResetData(templateLine),
      budgetId: budgetLine.budget_id,
    };
  }

  private async resolveTemplateAmount(
    templateLine: TemplateLineRow,
    user: AuthenticatedUser,
  ): Promise<number> {
    if (!templateLine.amount) return 0;
    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    return this.encryption.tryDecryptAmount(templateLine.amount, dek, 0);
  }

  private buildResetData(templateLine: TemplateLineRow) {
    return {
      name: templateLine.name,
      kind: templateLine.kind,
      recurrence: templateLine.recurrence,
      is_manually_adjusted: false,
      original_amount: templateLine.original_amount,
      original_currency: templateLine.original_currency,
      target_currency: templateLine.target_currency,
      exchange_rate: templateLine.exchange_rate,
      updated_at: new Date().toISOString(),
    };
  }
}
