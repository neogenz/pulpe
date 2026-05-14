import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type BudgetLineCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import { BudgetLineInvariants } from '../domain/budget-line.invariants';
import type {
  BudgetLine,
  BudgetLineCreateInput,
} from '../domain/budget-line.entity';

@Injectable()
export class CreateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(CreateBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetLineCreate,
    user: AuthenticatedUser,
  ): Promise<BudgetLine> {
    BudgetLineInvariants.validateCreate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);
    const input: BudgetLineCreateInput = {
      ...(withRate.id ? { id: withRate.id } : {}),
      budgetId: withRate.budgetId!,
      templateLineId: withRate.templateLineId ?? null,
      savingsGoalId: withRate.savingsGoalId ?? null,
      name: withRate.name,
      amount: withRate.amount,
      originalAmount: withRate.originalAmount ?? null,
      originalCurrency: withRate.originalCurrency ?? null,
      targetCurrency: withRate.targetCurrency ?? null,
      exchangeRate: withRate.exchangeRate ?? null,
      kind: withRate.kind,
      recurrence: withRate.recurrence,
      isManuallyAdjusted: withRate.isManuallyAdjusted ?? false,
      checkedAt: withRate.checkedAt ?? null,
    };

    const entity = await this.repo.insert(input);

    await this.budgetRecalculation.recalculate(entity.budgetId);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: entity.id,
        userId: user.id,
        operation: 'budgetLine.create',
      },
      'Budget line created',
    );

    return entity;
  }
}
