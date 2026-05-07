import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { ZodError } from 'zod';
import {
  type BudgetGenerate,
  type BudgetGenerateResponse,
  type Budget,
} from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { validateCreateBudgetResponse } from '../schemas/rpc-responses.schema';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '../domain/ports/budget-recalculation.port';
import { computeTargetMonths } from '../domain/budget.formulas';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';
import type { Tables } from '../../../types/database.types';

@Injectable()
export class GenerateBudgetsUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetMapper,
    @InjectInfoLogger(GenerateBudgetsUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetGenerate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetGenerateResponse> {
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
      supabase,
    );

    const createdBudgets: Budget[] = [];
    const skippedMonths: { month: number; year: number }[] = [];
    const createdBudgetIds: string[] = [];

    try {
      for (const target of targetMonths) {
        if (existingPeriods.has(`${target.month}/${target.year}`)) {
          skippedMonths.push(target);
          continue;
        }

        const result = await this.tryCreateSingleBudget(
          target,
          dto,
          user,
          supabase,
        );
        createdBudgets.push(result.budget);
        createdBudgetIds.push(result.budgetId);
        await this.budgetRecalculation.recalculate(
          result.budgetId,
          supabase,
          user.clientKey,
        );
      }
    } catch (error) {
      await this.cacheService.invalidateForUser(user.id);
      await this.rollbackCreatedBudgets(createdBudgetIds, supabase, user.id);
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
        undefined,
        { operation: 'generateBudgets', userId: user.id },
        { cause: error },
      );
    }

    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        userId: user.id,
        createdCount: createdBudgets.length,
        skippedCount: skippedMonths.length,
        operation: 'budget.generate.success',
      },
      'Budget generation completed',
    );

    return {
      success: true,
      data: { budgets: createdBudgets, skippedMonths },
    };
  }

  private async tryCreateSingleBudget(
    target: { month: number; year: number },
    dto: BudgetGenerate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ budget: Budget; budgetId: string }> {
    let rpcResult: unknown;
    try {
      rpcResult = await this.repo.createBudgetFromTemplateRpc(
        {
          p_user_id: user.id,
          p_template_id: dto.templateId,
          p_month: target.month,
          p_year: target.year,
          p_description: `Budget ${target.month}/${target.year}`,
        },
        supabase,
      );
    } catch (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        undefined,
        { userId: user.id, templateId: dto.templateId },
        { cause: error },
      );
    }

    const processedResult = this.processBudgetCreationResult(
      rpcResult,
      user.id,
      dto.templateId,
    );

    return {
      budget: this.mapper.toApi(
        processedResult.budgetData as Parameters<BudgetMapper['toApi']>[0],
      ),
      budgetId: processedResult.budgetData.id,
    };
  }

  private processBudgetCreationResult(
    result: unknown,
    userId: string,
    templateId: string,
  ): { budgetData: Tables<'monthly_budget'> } {
    try {
      const validatedResult = validateCreateBudgetResponse(result);
      return { budgetData: validatedResult.budget as Tables<'monthly_budget'> };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
          { reason: 'Invalid result structure from RPC' },
          { userId, templateId, operation: 'processBudgetCreationResult' },
          { cause: error },
        );
      }
      throw error;
    }
  }

  private async rollbackCreatedBudgets(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
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

    const deleted = await this.repo.deleteBudgetsByIds(budgetIds, supabase);
    if (!deleted) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
        { orphanedBudgetIds: budgetIds },
        { operation: 'budget.generate.rollback', userId },
      );
    }
  }
}
