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
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type {
  BudgetLine,
  SavingsWithdrawalDeleteScope,
} from '../domain/budget-line.entity';

/**
 * PUL-292 — grouped deletion of a savings-withdrawal pair, the server side of
 * the explicit choice (CA9): `pair` = « tout annuler » removes both lines,
 * `repayment` = « garder le Revenu de M seul » removes only the M+1 saving
 * (the income keeps its group id — the badge stays true). One DELETE statement
 * → atomic; no `checked_at` gate (consistent with the single-line delete).
 * Idempotent on the repayment side: a `repayment` scope whose saving is
 * already gone succeeds (the desired end-state holds).
 */
@Injectable()
export class DeleteSavingsWithdrawalUseCase {
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    private readonly cacheService: CacheService,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    @InjectInfoLogger(DeleteSavingsWithdrawalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    groupId: string,
    scope: SavingsWithdrawalDeleteScope,
    user: AuthenticatedUser,
  ): Promise<void> {
    const lines = await this.repo.findBySavingsWithdrawalGroupId(groupId);
    if (lines.length === 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_WITHDRAWAL_GROUP_NOT_FOUND,
        { groupId },
        {
          operation: 'budgetLine.savingsWithdrawal.delete',
          savingsWithdrawalGroupId: groupId,
          userId: user.id,
        },
      );
    }

    await this.repo.deleteSavingsWithdrawalGroup(groupId, scope);

    // Cache invalidation BEFORE recalc — if recalc fails, the about-to-be-stale
    // balances won't be locked in as the new cached authoritative read.
    await this.cacheService.invalidateForUser(user.id);

    const touchedBudgetIds = this.touchedBudgetIds(lines, scope);
    try {
      await Promise.all(
        touchedBudgetIds.map((id) => this.budgetRecalculation.recalculate(id)),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_WITHDRAWAL_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'budgetLine.savingsWithdrawal.delete.recalcAfterCommit',
          severity: 'critical',
          partialFailure: true,
          affectedBudgetIds: touchedBudgetIds,
          savingsWithdrawalGroupId: groupId,
          userId: user.id,
        },
        { cause },
      );
    }

    this.logger.info(
      {
        userId: user.id,
        savingsWithdrawalGroupId: groupId,
        scope,
        linesDeleted:
          scope === 'pair'
            ? lines.length
            : lines.filter((line) => line.kind === 'saving').length,
        operation: 'budgetLine.savingsWithdrawal.delete',
      },
      'Savings withdrawal group deleted',
    );
  }

  private touchedBudgetIds(
    lines: BudgetLine[],
    scope: SavingsWithdrawalDeleteScope,
  ): string[] {
    const deleted =
      scope === 'pair' ? lines : lines.filter((line) => line.kind === 'saving');
    return [...new Set(deleted.map((line) => line.budgetId))];
  }
}
