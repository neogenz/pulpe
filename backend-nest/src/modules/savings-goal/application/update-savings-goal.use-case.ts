import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  periodIndex,
  type SavingsGoalUpdate,
} from 'pulpe-shared';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '@modules/budget/domain/ports/budget-recalculation.port';
import {
  SAVINGS_GOAL_REPOSITORY,
  type SavingsGoalRepositoryPort,
} from '../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalUpdatePatch,
} from '../domain/savings-goal.entity';
import { selectEligibleSavingsGoalFutureLines } from './get-savings-goal-future-lines.use-case';

@Injectable()
export class UpdateSavingsGoalUseCase {
  constructor(
    @Inject(SAVINGS_GOAL_REPOSITORY)
    private readonly repo: SavingsGoalRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(UpdateSavingsGoalUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    id: string,
    dto: SavingsGoalUpdate,
    user: AuthenticatedUser,
  ): Promise<SavingsGoal> {
    let current: SavingsGoal | undefined;
    if (dto.startDate !== undefined || dto.targetDate !== undefined) {
      current = await this.repo.findById(id);
      this.validateMergedInterval(current, dto, user.id);
    }
    const patch = this.buildPatch(dto);
    const entity =
      current &&
      this.isTargetPeriodAdvance(current, dto, user.payDayOfMonth ?? null)
        ? await this.updateWithDeadlineReconciliation(
            id,
            current,
            dto,
            patch,
            user,
          )
        : await this.repo.update(id, patch);

    this.logger.info(
      { savingsGoalId: id, userId: user.id, operation: 'savingsGoal.update' },
      'Savings goal updated',
    );

    return entity;
  }

  private isTargetPeriodAdvance(
    current: SavingsGoal,
    dto: SavingsGoalUpdate,
    payDayOfMonth: number | null,
  ): dto is SavingsGoalUpdate & { targetDate: string } {
    if (
      typeof current.targetDate !== 'string' ||
      typeof dto.targetDate !== 'string'
    ) {
      return false;
    }
    const currentTargetPeriodIndex = periodIndex(
      getBudgetPeriodForDate(
        parseIsoDateLocal(current.targetDate),
        payDayOfMonth,
      ),
    );
    const nextTargetPeriodIndex = periodIndex(
      getBudgetPeriodForDate(parseIsoDateLocal(dto.targetDate), payDayOfMonth),
    );
    return nextTargetPeriodIndex < currentTargetPeriodIndex;
  }

  private async updateWithDeadlineReconciliation(
    id: string,
    current: SavingsGoal,
    dto: SavingsGoalUpdate & { targetDate: string },
    patch: SavingsGoalUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<SavingsGoal> {
    const expectedTargetDate = current.targetDate;
    if (expectedTargetDate === null) {
      return this.repo.update(id, patch);
    }
    const payDayOfMonth = user.payDayOfMonth ?? null;
    const lines = await this.repo.findLinkedSavingLines(id);
    const candidates = selectEligibleSavingsGoalFutureLines(
      lines,
      payDayOfMonth,
      dto.targetDate,
    );
    if (candidates.length > 0 && !dto.reconciliation) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_RECONCILIATION_REQUIRED,
        undefined,
        {
          operation: 'savingsGoal.update.reconciliationRequired',
          entityId: current.id,
          userId: user.id,
          candidateLineIds: candidates.map((line) => line.id),
        },
      );
    }

    const result = await this.repo.reconcileTargetDate(id, {
      patch,
      reconciliation: dto.reconciliation ?? {
        mode: 'freeze',
        budgetLineIds: [],
      },
      expectedTargetDate,
    });

    await this.refreshAfterCommit(result.touchedBudgetIds, id, user.id);
    return result.goal;
  }

  private async refreshAfterCommit(
    budgetIds: string[],
    savingsGoalId: string,
    userId: string,
  ): Promise<void> {
    if (budgetIds.length === 0) return;

    try {
      await this.cacheService.invalidateForUser(userId);
      await Promise.all(
        budgetIds.map((budgetId) =>
          this.budgetRecalculation.recalculate(budgetId),
        ),
      );
    } catch (cause) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_RECONCILIATION_RECALCULATION_FAILED,
        undefined,
        {
          operation: 'savingsGoal.update.refreshAfterReconciliation',
          severity: 'critical',
          partialFailure: true,
          affectedBudgetIds: budgetIds,
          savingsGoalId,
          userId,
        },
        { cause },
      );
    }
  }

  private buildPatch(dto: SavingsGoalUpdate): SavingsGoalUpdatePatch {
    const patch: SavingsGoalUpdatePatch = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.startDate !== undefined) patch.startDate = dto.startDate;
    if (dto.targetAmount !== undefined) patch.targetAmount = dto.targetAmount;
    if (dto.targetDate !== undefined) patch.targetDate = dto.targetDate;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.originalTargetAmount !== undefined) {
      patch.originalTargetAmount = dto.originalTargetAmount;
    }
    if (dto.initialAmount !== undefined) {
      patch.initialAmount = dto.initialAmount;
    }
    if (dto.originalCurrency !== undefined) {
      patch.originalCurrency = dto.originalCurrency;
    }
    if (dto.targetCurrency !== undefined) {
      patch.targetCurrency = dto.targetCurrency;
    }
    if (dto.exchangeRate !== undefined) patch.exchangeRate = dto.exchangeRate;
    return patch;
  }

  private validateMergedInterval(
    current: SavingsGoal,
    dto: SavingsGoalUpdate,
    userId: string,
  ): void {
    const startDate =
      dto.startDate === undefined ? current.startDate : dto.startDate;
    const targetDate =
      dto.targetDate === undefined ? current.targetDate : dto.targetDate;
    if (startDate == null || targetDate == null || startDate <= targetDate) {
      return;
    }

    throw new BusinessException(
      ERROR_DEFINITIONS.BUSINESS_RULE_VIOLATION,
      { rule: 'savings_goal_start_date_before_target_date' },
      {
        operation: 'savingsGoal.update',
        entityId: current.id,
        userId,
      },
    );
  }
}
