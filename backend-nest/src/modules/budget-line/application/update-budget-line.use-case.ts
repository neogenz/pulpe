import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { type BudgetLineUpdate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { CurrencyService } from '@modules/currency/currency.service';
import { savingsGoalIdPatchForKind } from '@common/utils/savings-goal-link';
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
} from '../domain/budget-line.entity';

@Injectable()
export class UpdateBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    private readonly currencyService: CurrencyService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(UpdateBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: BudgetLineUpdate,
    user: AuthenticatedUser,
  ): Promise<BudgetLine> {
    BudgetLineInvariants.validateUpdate(dto);

    const withRate = await this.currencyService.overrideExchangeRate(dto);
    const patch = this.buildPatch(withRate);

    const entity = await this.repo.update(id, patch);

    // Cache invalidation BEFORE recalc — if recalc fails, the stale cached
    // list won't be locked in as authoritative against the just-mutated row.
    await this.cacheService.invalidateForUser(user.id);
    await this.budgetRecalculation.recalculate(entity.budgetId);

    this.logger.info(
      { budgetLineId: id, userId: user.id, operation: 'budgetLine.update' },
      'Budget line updated',
    );

    return entity;
  }

  private buildPatch(dto: BudgetLineUpdate): BudgetLineUpdatePatch {
    const patch: BudgetLineUpdatePatch = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.amount !== undefined) patch.amount = dto.amount;
    if (dto.originalAmount !== undefined)
      patch.originalAmount = dto.originalAmount;
    if (dto.originalCurrency !== undefined) {
      patch.originalCurrency = dto.originalCurrency;
    }
    if (dto.targetCurrency !== undefined) {
      patch.targetCurrency = dto.targetCurrency;
    }
    if (dto.exchangeRate !== undefined) patch.exchangeRate = dto.exchangeRate;
    if (dto.kind !== undefined) patch.kind = dto.kind;
    if (dto.recurrence !== undefined) patch.recurrence = dto.recurrence;
    if (dto.templateLineId !== undefined) {
      patch.templateLineId = dto.templateLineId;
    }
    // CA11: kind moved off 'saving' clears the link, even when savingsGoalId
    // isn't in the patch (savingsGoalIdPatchForKind returns null in that case).
    const ruledSavingsGoalId = savingsGoalIdPatchForKind(
      dto.kind,
      dto.savingsGoalId,
    );
    if (ruledSavingsGoalId !== undefined) {
      patch.savingsGoalId = ruledSavingsGoalId;
    }
    if (dto.isManuallyAdjusted !== undefined) {
      patch.isManuallyAdjusted = dto.isManuallyAdjusted;
    }
    if (dto.checkedAt !== undefined) patch.checkedAt = dto.checkedAt;
    return patch;
  }
}
