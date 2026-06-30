import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_PERIOD_LOOKUP_PORT,
  type BudgetPeriodLookupPort,
} from '@modules/budget/domain/ports/budget-period-lookup.port';
import {
  TRANSACTION_REPOSITORY,
  type TransactionRepositoryPort,
} from '../domain/ports/transaction-repository.port';
import type { Transaction } from '../domain/transaction.entity';

export interface PostponeTransactionResult {
  entity: Transaction;
  sourceBudgetId: string;
  targetBudgetId: string;
}

/**
 * Shifts an ISO timestamp by +1 calendar month in UTC, clamping to the last day
 * of the target month (e.g. Jan 31 → Feb 28) and preserving the time-of-day.
 *
 * UTC-explicit on purpose: `date-fns` `addMonths` evaluates in the server's
 * local timezone, so a transaction stored near a month boundary (e.g.
 * `2026-01-31T23:00:00Z`) would shift to the wrong month on a non-UTC host.
 * Mirrors the UTC pinning in `resolve-next-month-budget.use-case`.
 */
function shiftIsoByOneMonthUtc(iso: string): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDayOfTargetMonth = new Date(
    Date.UTC(year, month + 2, 0),
  ).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      year,
      month + 1,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  ).toISOString();
}

/**
 * Postpones an eligible free transaction to the next month (PUL-22).
 *
 * Eligible = unchecked + free (`budget_line_id IS NULL`). The transaction keeps
 * its id/amount ciphertext; `budget_id` moves to the next month and
 * `transaction_date` shifts by +1 month (end-of-month clamp) so it stays
 * coherent with the target period. Both impacted budgets are recalculated.
 */
@Injectable()
export class PostponeTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly repo: TransactionRepositoryPort,
    @Inject(BUDGET_PERIOD_LOOKUP_PORT)
    private readonly periodLookup: BudgetPeriodLookupPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(PostponeTransactionUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PostponeTransactionResult> {
    const transaction = await this.repo.findById(id);
    const loggingContext = {
      operation: 'transaction.postpone',
      entityId: id,
      userId: user.id,
    };

    if (transaction.checkedAt !== null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_ALREADY_CHECKED,
        undefined,
        loggingContext,
      );
    }

    if (transaction.budgetLineId !== null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_ALLOCATED,
        undefined,
        loggingContext,
      );
    }

    const sourceBudgetId = transaction.budgetId;
    const targetBudgetId = await this.periodLookup.findNextMonthBudgetId(
      sourceBudgetId,
      user.id,
    );

    if (!targetBudgetId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TARGET_BUDGET_NOT_FOUND,
        undefined,
        loggingContext,
      );
    }

    const shiftedDate = shiftIsoByOneMonthUtc(transaction.transactionDate);

    const entity = await this.repo.postpone(
      id,
      sourceBudgetId,
      targetBudgetId,
      shiftedDate,
    );

    // Cache invalidation BEFORE recalc — a stale cached list must not be locked
    // in as authoritative against the just-moved row.
    await this.cacheService.invalidateForUser(user.id);
    // Independent budgets, disjoint rows — recalc in parallel (one round-trip
    // instead of two), matching the spread / bulk-template multi-budget pattern.
    await Promise.all([
      this.budgetRecalculation.recalculate(sourceBudgetId),
      this.budgetRecalculation.recalculate(targetBudgetId),
    ]);

    this.logger.info(
      { ...loggingContext, sourceBudgetId, targetBudgetId },
      'Transaction postponed to next month',
    );

    return { entity, sourceBudgetId, targetBudgetId };
  }
}
