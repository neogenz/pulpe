import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
  type TemplateLineCreateWithoutTemplateId,
  budgetTemplateCreateSchema,
} from 'pulpe-shared';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '../domain/ports/budget-template-repository.port';
import { BudgetTemplateInvariants } from '../domain/budget-template.invariants';
import { BudgetTemplateMapper } from '../infrastructure/mappers/budget-template.mapper';
import type { TemplateLineRpcInput } from '../domain/budget-template.entity';

@Injectable()
export class CreateTemplateUseCase {
  constructor(
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly repo: BudgetTemplateRepositoryPort,
    private readonly currencyService: CurrencyService,
    private readonly mapper: BudgetTemplateMapper,
    @InjectInfoLogger(CreateTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    createDto: BudgetTemplateCreate,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BudgetTemplateCreateResponse> {
    const startTime = Date.now();

    const validated = budgetTemplateCreateSchema.parse(createDto);

    const count = await this.repo.countForUser(user.id);
    BudgetTemplateInvariants.validateTemplateLimit(count);

    if (validated.isDefault) {
      await this.repo.resetDefaultTemplates(user.id, null);
    }

    const overriddenLines = await Promise.all(
      validated.lines.map((line) =>
        this.currencyService.overrideExchangeRate(line),
      ),
    );

    const template = await this.repo.createTemplateWithLines({
      userId: user.id,
      name: validated.name,
      description: validated.description,
      isDefault: validated.isDefault ?? false,
      lines: overriddenLines.map((line) => this.toRpcInput(line)),
    });

    const lines = await this.repo.findLinesByTemplateId(template.id);

    this.logger.info(
      {
        operation: 'create',
        userId: user.id,
        entityId: template.id,
        duration: Date.now() - startTime,
      },
      'Template created successfully',
    );

    return {
      success: true,
      data: {
        template: this.mapper.toApiTemplate(template),
        lines: this.mapper.toApiTemplateLineList(lines),
      },
    };
  }

  private toRpcInput(
    line: TemplateLineCreateWithoutTemplateId,
  ): TemplateLineRpcInput {
    return {
      name: line.name,
      amount: line.amount,
      kind: line.kind,
      recurrence: line.recurrence,
      description: line.description ?? '',
      originalAmount: line.originalAmount ?? null,
      originalCurrency: line.originalCurrency ?? null,
      targetCurrency: line.targetCurrency ?? null,
      exchangeRate: line.exchangeRate ?? null,
    };
  }
}
