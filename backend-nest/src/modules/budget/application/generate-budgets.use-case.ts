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
import { computeTargetMonths } from '../domain/budget.formulas';
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
    const targetMonths = computeTargetMonths(
      dto.startMonth,
      dto.startYear,
      dto.count,
    );

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

    const existingPeriods = await this.repo.getExistingPeriods(
      user.id,
      targetMonths,
    );

    const createdBudgetIds: string[] = [];
    const skippedMonths: { month: number; year: number }[] = [];

    try {
      for (const target of targetMonths) {
        if (existingPeriods.has(`${target.month}/${target.year}`)) {
          skippedMonths.push(target);
          continue;
        }

        const budgetId = await this.tryCreateSingleBudget(target, dto, user);
        createdBudgetIds.push(budgetId);
        await this.budgetRecalculation.recalculate(budgetId, user.clientKey);
      }
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      await this.rollbackCreatedBudgets(createdBudgetIds, user.id);
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
        undefined,
        { operation: 'generateBudgets', userId: user.id },
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

  private async tryCreateSingleBudget(
    target: { month: number; year: number },
    dto: BudgetGenerate,
    user: AuthenticatedUser,
  ): Promise<string> {
    try {
      const result = await this.repo.createBudgetFromTemplateRpc({
        p_user_id: user.id,
        p_template_id: dto.templateId,
        p_month: target.month,
        p_year: target.year,
        p_description: `Budget ${target.month}/${target.year}`,
      });
      return result.budget.id;
    } catch (error) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        undefined,
        { userId: user.id, templateId: dto.templateId },
        { cause: error },
      );
    }
  }

  private async rollbackCreatedBudgets(
    budgetIds: string[],
    userId: string,
  ): Promise<void> {
    if (budgetIds.length === 0) return;

    this.logger.warn(
      {
        userId,
        budgetIds,
        operation: 'budget.generate.rollback',
      },
      'Rolling back created budgets after generation failure',
    );

    const deleted = await this.repo.deleteBudgetsByIds(budgetIds);
    if (!deleted) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
        { orphanedBudgetIds: budgetIds },
        { operation: 'budget.generate.rollback', userId },
      );
    }
  }
}
