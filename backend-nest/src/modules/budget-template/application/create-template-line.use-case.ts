import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type TemplateLineCreateWithoutTemplateId,
  type TemplateLineResponse,
  templateLineCreateWithoutTemplateIdSchema,
} from 'pulpe-shared';
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
export class CreateTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
    private readonly currencyService: CurrencyService,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(CreateTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    createDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TemplateLineResponse> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id);
    let validated = templateLineCreateWithoutTemplateIdSchema.parse(createDto);
    validated = await this.currencyService.overrideExchangeRate(validated);

    const [{ amount }, encryptedOriginalAmount] = await Promise.all([
      this.encryption.prepareAmountData(
        validated.amount,
        user.id,
        user.clientKey,
      ),
      this.encryption.encryptOptionalAmount(
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

    const line = await this.repo.insertLine(insertData);

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

    const dek = await this.encryption.getUserDEK(user.id, user.clientKey);
    const decryptedLine = this.mapper.decryptLine(line, this.encryption, dek);

    return {
      success: true,
      data: this.mapper.toApiTemplateLine(decryptedLine),
    };
  }
}
