import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type TemplateLineCreateWithoutTemplateId,
  templateLineCreateWithoutTemplateIdSchema,
} from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import type { TemplateLine } from '../domain/budget-template.entity';

@Injectable()
export class CreateTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly currencyService: CurrencyService,
    @InjectInfoLogger(CreateTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    templateId: string,
    createDto: TemplateLineCreateWithoutTemplateId,
    user: AuthenticatedUser,
  ): Promise<TemplateLine> {
    const startTime = Date.now();

    await this.repo.validateAccess(templateId, user.id);
    let validated = templateLineCreateWithoutTemplateIdSchema.parse(createDto);
    validated = await this.currencyService.overrideExchangeRate(validated);

    const line = await this.repo.insertLine({
      templateId,
      name: validated.name,
      amount: validated.amount,
      originalAmount: validated.originalAmount,
      originalCurrency: validated.originalCurrency,
      targetCurrency: validated.targetCurrency,
      exchangeRate: validated.exchangeRate,
      kind: validated.kind,
      recurrence: validated.recurrence,
      description: validated.description,
    });

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

    return line;
  }
}
