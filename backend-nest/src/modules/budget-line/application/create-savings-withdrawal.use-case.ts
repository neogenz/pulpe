import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type BudgetLineSavingsWithdrawalCreate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  BUDGET_PROVISIONING_PORT,
  type BudgetProvisioningPort,
  type EnsureBudgetsResult,
} from '@modules/budget/domain/ports/budget-provisioning.port';
import {
  BUDGET_PERIOD_LOOKUP_PORT,
  type BudgetPeriod,
  type BudgetPeriodLookupPort,
} from '@modules/budget/domain/ports/budget-period-lookup.port';
import {
  BUDGET_TEMPLATE_REPOSITORY,
  type BudgetTemplateRepositoryPort,
} from '@modules/budget-template/domain/ports/budget-template-repository.port';
import {
  BUDGET_LINE_REPOSITORY,
  type BudgetLineRepositoryPort,
} from '../domain/ports/budget-line-repository.port';
import type { BudgetLine } from '../domain/budget-line.entity';
import { SavingsWithdrawalPairExistsError } from '../domain/savings-withdrawal-conflict.error';

export interface SavingsWithdrawalResult {
  groupId: string;
  incomeLine: BudgetLine;
  savingLine: BudgetLine;
  createdBudget: EnsureBudgetsResult['createdBudgets'][number] | null;
}

/**
 * PUL-292 — « piocher dans son épargne » : ONE action creates the linked PAIR —
 * an income `one_off` of `amount` on the viewed month M and a repayment saving
 * `one_off` of the SAME `amount` on M+1, sharing `savings_withdrawal_group_id`.
 * Zero-sum over two months by construction (a single wire `amount`).
 *
 * Flow (mirrors the PUL-17 spread create, pair-simplified):
 * 1. derive M+1 from the source budget (ownership-checked, December rollover);
 * 2. STRICT provisioning of M+1 via `BUDGET_PROVISIONING_PORT` — no default
 *    template → 422 and NOTHING is created (half a pair corrupts the books);
 * 3. atomic pair insert (one multi-row statement); a replayed client `groupId`
 *    trips the partial UNIQUE index and REPLAYS the original result instead of
 *    duplicating (Stripe-style idempotency, constraint-guarded);
 * 4. recalculate BOTH budgets, then invalidate the user cache ONCE on success
 *    AND failure (the mutation crosses two months — cross-budget invalidation
 *    is the most likely bug to ship if forgotten).
 *
 * Atomicity boundary (same as PUL-17): the M+1 budget auto-creation runs in its
 * own short idempotent transaction and is deliberately NOT rolled back if the
 * pair insert later fails — a retry reuses it.
 */
@Injectable()
export class CreateSavingsWithdrawalUseCase {
  // eslint-disable-next-line max-params
  constructor(
    @Inject(BUDGET_LINE_REPOSITORY)
    private readonly repo: BudgetLineRepositoryPort,
    @Inject(BUDGET_PROVISIONING_PORT)
    private readonly provisioning: BudgetProvisioningPort,
    @Inject(BUDGET_PERIOD_LOOKUP_PORT)
    private readonly periodLookup: BudgetPeriodLookupPort,
    @Inject(BUDGET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: BudgetTemplateRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(CreateSavingsWithdrawalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetLineSavingsWithdrawalCreate,
    user: AuthenticatedUser,
  ): Promise<SavingsWithdrawalResult> {
    try {
      const result = await this.provisionAndInsert(dto, user);
      await this.cacheService.invalidateForUser(user.id);
      return result;
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      throw this.toCreateError(error, user);
    }
  }

  private async provisionAndInsert(
    dto: BudgetLineSavingsWithdrawalCreate,
    user: AuthenticatedUser,
  ): Promise<SavingsWithdrawalResult> {
    // A client-supplied key is the idempotency token; absent → server-minted.
    // The same value becomes the DB `savings_withdrawal_group_id`.
    const groupId = dto.groupId ?? randomUUID();
    const { repaymentBudgetId, createdBudget } =
      await this.ensureRepaymentBudget(dto, user);

    const fx = {
      originalAmount: dto.originalAmount ?? null,
      originalCurrency: dto.originalCurrency ?? null,
      targetCurrency: dto.targetCurrency ?? null,
      exchangeRate: dto.exchangeRate ?? null,
    } as const;

    try {
      const lines = await this.repo.createSavingsWithdrawalPair(groupId, {
        income: {
          budgetId: dto.budgetId,
          name: dto.incomeName,
          amount: dto.amount,
          kind: 'income',
          recurrence: 'one_off',
          ...fx,
        },
        saving: {
          budgetId: repaymentBudgetId,
          name: dto.savingName,
          amount: dto.amount,
          kind: 'saving',
          recurrence: 'one_off',
          ...fx,
        },
      });
      return await this.finalizePair(groupId, lines, createdBudget, user);
    } catch (error) {
      // Idempotent retry: the client replayed its own groupId and the partial
      // UNIQUE index fired. Serve the pair already created instead of a dup.
      if (dto.groupId && error instanceof SavingsWithdrawalPairExistsError) {
        return this.replayExistingPair(dto.groupId, createdBudget, user);
      }
      throw error;
    }
  }

  /**
   * STRICT M+1 provisioning: the repayment month is resolved from the source
   * budget (ownership-checked) and ensured from the default template. A month
   * that cannot be provisioned fails the WHOLE op (422) — the pair invariant
   * forbids creating the income without its repayment.
   */
  private async ensureRepaymentBudget(
    dto: BudgetLineSavingsWithdrawalCreate,
    user: AuthenticatedUser,
  ): Promise<{
    repaymentBudgetId: string;
    createdBudget: SavingsWithdrawalResult['createdBudget'];
  }> {
    const repaymentPeriod = await this.periodLookup.findNextMonthPeriod(
      dto.budgetId,
      user.id,
    );
    const templateId = await this.templateRepo.findDefaultTemplateId(user.id);
    const ensured = await this.provisioning.ensureBudgetsForPeriods(
      [repaymentPeriod],
      templateId,
      user.id,
    );

    const repaymentBudgetId = ensured.budgetIdByPeriod.get(
      this.periodKey(repaymentPeriod),
    );
    if (ensured.skippedMonths.length > 0 || !repaymentBudgetId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_WITHDRAWAL_MONTH_UNPROVISIONABLE,
        { month: repaymentPeriod.month, year: repaymentPeriod.year },
        { operation: 'budgetLine.savingsWithdrawal', userId: user.id },
      );
    }

    return {
      repaymentBudgetId,
      createdBudget: ensured.createdBudgets[0] ?? null,
    };
  }

  private async finalizePair(
    groupId: string,
    lines: BudgetLine[],
    createdBudget: SavingsWithdrawalResult['createdBudget'],
    user: AuthenticatedUser,
  ): Promise<SavingsWithdrawalResult> {
    const { incomeLine, savingLine } = this.splitPair(groupId, lines, user);
    await this.recalculateAfterCommit(
      [...new Set([incomeLine.budgetId, savingLine.budgetId])],
      groupId,
      user.id,
    );

    this.logger.info(
      {
        userId: user.id,
        savingsWithdrawalGroupId: groupId,
        budgetCreated: createdBudget !== null,
        operation: 'budgetLine.savingsWithdrawal',
      },
      'Savings withdrawal pair created',
    );

    return { groupId, incomeLine, savingLine, createdBudget };
  }

  /**
   * Idempotent replay: the unique-index guard fired on a retry reusing the same
   * client key. Return the pair the FIRST attempt committed and re-run the
   * (idempotent) recalculation — healing a balance the first attempt left stale
   * by failing its recalc after the insert committed. An incomplete fetch (not
   * the caller's group under RLS, or the repayment already deleted) surfaces a
   * 409 rather than fabricating a success.
   */
  private async replayExistingPair(
    groupId: string,
    createdBudget: SavingsWithdrawalResult['createdBudget'],
    user: AuthenticatedUser,
  ): Promise<SavingsWithdrawalResult> {
    const lines = await this.repo.findBySavingsWithdrawalGroupId(groupId);
    const { incomeLine, savingLine } = this.splitPair(groupId, lines, user);
    await this.recalculateAfterCommit(
      [...new Set([incomeLine.budgetId, savingLine.budgetId])],
      groupId,
      user.id,
    );

    this.logger.info(
      {
        userId: user.id,
        savingsWithdrawalGroupId: groupId,
        operation: 'budgetLine.savingsWithdrawal.replay',
      },
      'Savings withdrawal replay served the existing pair',
    );

    return { groupId, incomeLine, savingLine, createdBudget };
  }

  private splitPair(
    groupId: string,
    lines: BudgetLine[],
    user: AuthenticatedUser,
  ): { incomeLine: BudgetLine; savingLine: BudgetLine } {
    const incomeLine = lines.find((line) => line.kind === 'income');
    const savingLine = lines.find((line) => line.kind === 'saving');
    if (!incomeLine || !savingLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_WITHDRAWAL_CONFLICT,
        undefined,
        {
          operation: 'budgetLine.savingsWithdrawal.replay',
          savingsWithdrawalGroupId: groupId,
          userId: user.id,
        },
      );
    }
    return { incomeLine, savingLine };
  }

  private async recalculateAfterCommit(
    budgetIds: string[],
    groupId: string,
    userId: string,
  ): Promise<void> {
    try {
      await Promise.all(
        budgetIds.map((id) => this.budgetRecalculation.recalculate(id)),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_WITHDRAWAL_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'budgetLine.savingsWithdrawal.recalcAfterCommit',
          severity: 'critical',
          partialFailure: true,
          affectedBudgetIds: budgetIds,
          savingsWithdrawalGroupId: groupId,
          userId,
        },
        { cause },
      );
    }
  }

  private toCreateError(
    error: unknown,
    user: AuthenticatedUser,
  ): BusinessException {
    if (error instanceof BusinessException) return error;
    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
      undefined,
      { operation: 'budgetLine.savingsWithdrawal', userId: user.id },
      { cause: error },
    );
  }

  private periodKey(period: BudgetPeriod): string {
    return `${period.month}/${period.year}`;
  }
}
