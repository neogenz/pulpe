import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type TemplateLineUpdate,
  templateLineUpdateSchema,
} from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import type { TemplateLine } from '../domain/budget-template.entity';

@Injectable()
export class UpdateTemplateLineUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly currencyService: CurrencyService,
    @InjectInfoLogger(UpdateTemplateLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    lineId: string,
    updateDto: TemplateLineUpdate,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<TemplateLine> {
    const startTime = Date.now();

    await this.repo.validateLineAccess(lineId, user.id);
    let validated = templateLineUpdateSchema.parse(updateDto);
    validated = await this.currencyService.overrideExchangeRate(validated);

    const line = await this.repo.updateLine(lineId, {
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
        operation: 'updateTemplateLine',
        userId: user.id,
        entityId: lineId,
        duration: Date.now() - startTime,
      },
      'Template line updated successfully',
    );

    return line;
  }
}
