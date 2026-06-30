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
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { BudgetLine } from '../domain/budget-line.entity';

export interface PostponeBudgetLineResult {
  entity: BudgetLine;
  sourceBudgetId: string;
  targetBudgetId: string;
}

/**
 * Postpones an eligible budget line to the next month (PUL-22).
 *
 * Eligible = unchecked + `recurrence = 'one_off'` + zero allocated
 * transactions. The line keeps its id/amount ciphertext; only `budget_id`,
 * `template_line_id` (→ null, never touches the template) and
 * `is_manually_adjusted` change. Both impacted budgets are recalculated.
 */
@Injectable()
export class PostponeBudgetLineUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(BUDGET_PERIOD_LOOKUP_PORT)
    private readonly periodLookup: BudgetPeriodLookupPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(PostponeBudgetLineUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    user: AuthenticatedUser,
  ): Promise<PostponeBudgetLineResult> {
    const line = await this.repo.findById(id);
    const loggingContext = {
      operation: 'budgetLine.postpone',
      entityId: id,
      userId: user.id,
    };

    if (line.checkedAt !== null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_CHECKED,
        undefined,
        loggingContext,
      );
    }

    if (line.recurrence !== 'one_off') {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_POSTPONABLE,
        undefined,
        loggingContext,
      );
    }

    // A spread occurrence (PUL-17) is a one_off line bound to a cross-month group
    // via spreadGroupId. Moving one occurrence would leave its siblings behind and
    // break the group's month distribution — so it is not postponable (mirrors
    // `canSpread`, which excludes already-spread lines).
    if (line.spreadGroupId !== null) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_POSTPONABLE,
        undefined,
        loggingContext,
      );
    }

    // Pre-check, intentionally NOT atomic with the UPDATE below: the allocated-tx
    // count lives on the transaction table and can't be re-checked in a single
    // supabase-js UPDATE (unlike checked_at / recurrence / spread_group_id, which
    // the repo re-guards atomically). The TOCTOU window — a transaction allocated
    // to this line between this read and the move — is accepted: Pulpe is
    // single-user-per-budget with no concurrent writer of transaction.budget_line_id,
    // and the resulting cross-budget orphan is recoverable. Closing it fully would
    // require a SECURITY DEFINER RPC (deferred — disproportionate to the risk).
    if (await this.repo.hasAllocatedTransactions(id)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_HAS_TRANSACTIONS,
        undefined,
        loggingContext,
      );
    }

    const sourceBudgetId = line.budgetId;
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

    const entity = await this.repo.postpone(id, sourceBudgetId, targetBudgetId);

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
      'Budget line postponed to next month',
    );

    return { entity, sourceBudgetId, targetBudgetId };
  }
}
