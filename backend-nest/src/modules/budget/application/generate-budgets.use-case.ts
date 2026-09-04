import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type BudgetGenerate } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '../domain/ports/budget-recalculation.port';
import type { Budget } from '../domain/budget.entity';

@Injectable()
export class GenerateBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    @InjectInfoLogger(GenerateBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetGenerate,
    user: AuthenticatedUser,
  ): Promise<{
    budgets: Budget[];
    skippedMonths: { month: number; year: number }[];
  }> {
    this.logger.info(
      {
        userId: user.id,
        count: dto.count,
        startMonth: dto.startMonth,
        startYear: dto.startYear,
        operation: 'budget.generate.start',
      },
      'Starting budget generation',
    );

    let createdBudgetIds: string[] = [];
    let skippedMonths: { month: number; year: number }[] = [];

    try {
      const generated = await this.repo.generateBudgetsFromTemplateAtomically({
        userId: user.id,
        templateId: dto.templateId,
        startMonth: dto.startMonth,
        startYear: dto.startYear,
        count: dto.count,
      });
      createdBudgetIds = generated.createdBudgetIds;
      skippedMonths = generated.skippedMonths;

      for (const budgetId of createdBudgetIds) {
        await this.budgetRecalculation.recalculate(budgetId);
      }
    } catch (error) {
      if (createdBudgetIds.length === 0) {
        createdBudgetIds = this.createdBudgetIdsFrom(error);
      }
      const orphanedBudgetIds = await this.rollbackCreatedBudgets(
        createdBudgetIds,
        user.id,
        error,
      );
      try {
        await this.cacheService.invalidateForUser(user.id);
      } catch (cacheError) {
        this.logger.warn(
          {
            userId: user.id,
            err: cacheError,
            originalErrMessage:
              error instanceof Error ? error.message : String(error),
            operation: 'budget.generate.cache-invalidation.failed',
          },
          'Cache invalidation failed after budget generation rollback',
        );
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
        undefined,
        {
          operation: 'generateBudgets',
          userId: user.id,
          ...(orphanedBudgetIds.length > 0 ? { orphanedBudgetIds } : {}),
        },
        { cause: error },
      );
    }

    await this.cacheService.invalidateForUser(user.id);

    const createdBudgets = await Promise.all(
      createdBudgetIds.map((id) => this.repo.fetchBudgetById(id, user.id)),
    );

    this.logger.info(
      {
        userId: user.id,
        createdCount: createdBudgets.length,
        skippedCount: skippedMonths.length,
        operation: 'budget.generate.success',
      },
      'Budget generation completed',
    );

    return { budgets: createdBudgets, skippedMonths };
  }

  private createdBudgetIdsFrom(error: unknown): string[] {
    if (!(error instanceof BusinessException)) return [];
    const ids = error.loggingContext.createdBudgetIds;
    return Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
  }

  private async rollbackCreatedBudgets(
    budgetIds: string[],
    userId: string,
    originalError: unknown,
  ): Promise<string[]> {
    if (budgetIds.length === 0) return [];

    this.logger.warn(
      {
        userId,
        budgetIds,
        operation: 'budget.generate.rollback',
      },
      'Rolling back created budgets after generation failure',
    );

    try {
      const deleted = await this.repo.deleteBudgetsByIds(budgetIds);
      if (deleted) return [];
    } catch (rollbackError) {
      this.logger.warn(
        {
          userId,
          budgetIds,
          err: rollbackError,
          originalErrMessage:
            originalError instanceof Error
              ? originalError.message
              : String(originalError),
          operation: 'budget.generate.rollback.failed',
        },
        'Rollback of created budgets failed; budgets remain orphaned',
      );
    }

    return budgetIds;
  }
}
