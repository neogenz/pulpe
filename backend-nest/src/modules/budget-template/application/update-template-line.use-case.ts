import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type TemplateLineResponse,
  type TemplateLineUpdate,
  templateLineUpdateSchema,
} from 'pulpe-shared';
import type { TablesInsert } from '@/types/database.types';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class UpdateTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly currencyService: CurrencyService,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(UpdateTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    lineId: string,
    updateDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    await this.repo.validateLineAccess(lineId, user.id, supabase);
    let validated = templateLineUpdateSchema.parse(updateDto);
    validated = await this.currencyService.overrideExchangeRate(validated);

    let encryptedAmount: string | undefined;
    if (validated.amount !== undefined) {
      const prepared = await this.encryption.prepareAmountData(
        validated.amount,
        user.id,
        user.clientKey,
      );
      encryptedAmount = prepared.amount;
    }

    const encryptedOriginalAmount =
      validated.originalAmount !== undefined
        ? await this.encryption.encryptOptionalAmount(
            validated.originalAmount,
            user.id,
            user.clientKey,
          )
        : undefined;

    const updateData: Partial<TablesInsert<'template_line'>> = {
      ...this.mapper.toDbTemplateLineUpdate(validated, encryptedAmount),
      ...(encryptedAmount !== undefined && { amount: encryptedAmount }),
      ...(encryptedOriginalAmount !== undefined && {
        original_amount: encryptedOriginalAmount,
      }),
    };

    const line = await this.repo.updateLine(lineId, updateData, supabase);

    this.logger.info(
      {
        operation: 'updateTemplateLine',
        userId: user.id,
        entityId: lineId,
        duration: Date.now() - startTime,
      },
      'Template line updated successfully',
    );

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decryptedLine = this.mapper.decryptLine(line, this.encryption, dek);

    return {
      success: true,
      data: this.mapper.toApiTemplateLine(decryptedLine),
    };
  }
}
