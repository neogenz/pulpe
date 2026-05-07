import { Inject, Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type BudgetCreate, type BudgetResponse } from 'pulpe-shared';
import { CacheService } from '@modules/cache/cache.service';
import { ZodError } from 'zod';
import { validateCreateBudgetResponse } from '../schemas/rpc-responses.schema';
import {
  BUDGET_REPOSITORY,
  type BudgetRepositoryPort,
} from '../domain/ports/budget-repository.port';
import {
  BUDGET_RECALCULATION_PORT,
  type BudgetRecalculationPort,
} from '../domain/ports/budget-recalculation.port';
import { BudgetInvariants } from '../domain/budget.invariants';
import { BudgetMapper } from '../infrastructure/mappers/budget.mapper';
import type { Tables } from '../../../types/database.types';

@Injectable()
export class CreateBudgetUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly repo: BudgetRepositoryPort,
    @Inject(BUDGET_RECALCULATION_PORT)
    private readonly budgetRecalculation: BudgetRecalculationPort,
    private readonly cacheService: CacheService,
    private readonly mapper: BudgetMapper,
    @InjectInfoLogger(CreateBudgetUseCase.name)
    private readonly logger: InfoLogger,
  ) {}

  async execute(
    dto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    BudgetInvariants.validateCreate(dto);

    await this.validateNoDuplicatePeriod(supabase, dto.month, dto.year);

    const processedResult = await this.createBudgetFromTemplate(
      dto,
      user,
      supabase,
    );

    await this.budgetRecalculation.recalculate(
      processedResult.budgetData.id,
      supabase,
      user.clientKey,
    );
    await this.cacheService.invalidateForUser(user.id);

    this.logger.info(
      {
        userId: user.id,
        budgetId: processedResult.budgetData.id,
        operation: 'budget.create',
      },
      'Budget created',
    );

    return {
      success: true,
      data: this.mapper.toApi(
        processedResult.budgetData as Parameters<BudgetMapper['toApi']>[0],
      ),
    };
  }

  private async createBudgetFromTemplate(
    dto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const startTime = Date.now();

    this.logger.info(
      {
        userId: user.id,
        templateId: dto.templateId,
        period: `${dto.month}/${dto.year}`,
        operation: 'budget.create.start',
      },
      'Starting budget creation from template',
    );

    const result = await this.executeBudgetCreationRpc(dto, user, supabase);
    const processedResult = this.processBudgetCreationResult(
      result,
      user.id,
      dto.templateId!,
    );

    this.logger.info(
      {
        userId: user.id,
        budgetId: processedResult.budgetData.id,
        templateId: dto.templateId,
        templateName: processedResult.templateName,
        period: `${dto.month}/${dto.year}`,
        linesCreated: processedResult.budgetLinesCreated,
        duration: Date.now() - startTime,
        operation: 'budget.create.success',
      },
      'Budget created from template with atomic transaction',
    );

    return processedResult;
  }

  private async executeBudgetCreationRpc(
    dto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    try {
      return await this.repo.createBudgetFromTemplateRpc(
        {
          p_user_id: user.id,
          p_template_id: dto.templateId!,
          p_month: dto.month,
          p_year: dto.year,
          p_description: dto.description,
        },
        supabase,
      );
    } catch (error) {
      throw this.mapPostgreSQLErrorToBusinessException(
        error,
        user.id,
        dto.templateId!,
      );
    }
  }

  private processBudgetCreationResult(
    result: unknown,
    userId: string,
    templateId: string,
  ): {
    budgetData: Tables<'monthly_budget'>;
    budgetLinesCreated: number;
    templateName: string;
  } {
    try {
      const validatedResult = validateCreateBudgetResponse(result);
      return {
        budgetData: validatedResult.budget as Tables<'monthly_budget'>,
        budgetLinesCreated: validatedResult.budget_lines_created,
        templateName: validatedResult.template_name,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
          { reason: 'Invalid result structure from RPC' },
          {
            userId,
            templateId,
            validationErrors: error.issues,
            operation: 'processBudgetCreationResult',
          },
          { cause: error },
        );
      }
      throw error;
    }
  }

  private mapPostgreSQLErrorToBusinessException(
    error: unknown,
    userId: string,
    templateId: string,
  ): BusinessException {
    const errorObj = error as { code?: string; message?: string };
    const errorCode = errorObj?.code;
    const errorMessage = errorObj?.message || '';

    if (errorCode === '23505') {
      return new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        undefined,
        { userId, templateId },
      );
    }

    if (errorCode === '23503') {
      return new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
        id: templateId,
      });
    }

    if (errorCode === 'P0001') {
      if (errorMessage.includes('Budget already exists for this period')) {
        return new BusinessException(
          ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
          undefined,
          { userId, templateId },
        );
      }
      if (
        errorMessage.includes('Template not found') ||
        errorMessage.includes('access denied')
      ) {
        return new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
          id: templateId,
        });
      }
    }

    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
      undefined,
      { userId, templateId },
      { cause: error },
    );
  }

  private async validateNoDuplicatePeriod(
    supabase: AuthenticatedSupabaseClient,
    month: number,
    year: number,
  ): Promise<void> {
    const { data: existingBudget } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .single();

    if (existingBudget) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month, year },
      );
    }
  }
}
