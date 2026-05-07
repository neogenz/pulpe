import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineResponse,
  templateLineCreateWithoutTemplateIdSchema,
} from 'pulpe-shared';
import { EncryptionService } from '@modules/encryption/encryption.service';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';

@Injectable()
export class CreateTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly encryptionService: EncryptionService,
    private readonly currencyService: CurrencyService,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(CreateTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    createDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id, supabase);
    let validated = templateLineCreateWithoutTemplateIdSchema.parse(createDto);
    validated = await this.currencyService.overrideExchangeRate(validated);

    const [{ amount }, encryptedOriginalAmount] = await Promise.all([
      this.encryptionService.prepareAmountData(
        validated.amount,
        user.id,
        user.clientKey,
      ),
      this.encryptionService.encryptOptionalAmount(
        validated.originalAmount,
        user.id,
        user.clientKey,
      ),
    ]);

    const insertData = {
      ...this.mapper.toDbTemplateLineInsert(validated, templateId, amount),
      amount,
      ...(encryptedOriginalAmount !== null && {
        original_amount: encryptedOriginalAmount,
      }),
    };

    const line = await this.repo.insertLine(insertData, supabase);

    this.logger.info(
      {
        operation: 'createTemplateLine',
        userId: user.id,
        entityId: templateId,
        duration: Date.now() - startTime,
        lineId: line.id,
      },
      'Template line created successfully',
    );

    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decryptedLine = this.mapper.decryptLine(
      line,
      this.encryptionService,
      dek,
    );

    return {
      success: true,
      data: this.mapper.toApiTemplateLine(decryptedLine),
    };
  }
}
