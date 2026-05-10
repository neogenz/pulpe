import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
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
import type {
  BudgetLine,
  BudgetLineUpdatePatch,
  TemplateLine,
} from '../domain/budget-line.entity';

@Injectable()
export class ResetBudgetLineFromTemplateUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(ResetBudgetLineFromTemplateUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
    _supabase: unknown,
  ): Promise<BudgetLine> {
    const budgetLine = await this.repo.findById(id);
    BudgetLineInvariants.validateTemplateLineIdExists(
      budgetLine.templateLineId,
    );

    const templateLine = await this.repo.fetchTemplateLineById(
      budgetLine.templateLineId!,
    );

    const patch = this.buildResetPatch(templateLine);
    const entity = await this.repo.update(id, patch);

    await this.budgetRecalculation.recalculate(entity.budgetId, user.clientKey);
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        budgetLineId: id,
        userId: user.id,
        operation: 'budgetLine.resetFromTemplate',
      },
      'Budget line reset from template',
    );

    return entity;
  }

  private buildResetPatch(templateLine: TemplateLine): BudgetLineUpdatePatch {
    return {
      name: templateLine.name,
      amount: templateLine.amount,
      originalAmount: templateLine.originalAmount,
      originalCurrency:
        (templateLine.originalCurrency as BudgetLineUpdatePatch['originalCurrency']) ??
        null,
      targetCurrency:
        (templateLine.targetCurrency as BudgetLineUpdatePatch['targetCurrency']) ??
        null,
      exchangeRate: templateLine.exchangeRate,
      kind: templateLine.kind,
      recurrence: templateLine.recurrence,
      isManuallyAdjusted: false,
    };
  }
}
