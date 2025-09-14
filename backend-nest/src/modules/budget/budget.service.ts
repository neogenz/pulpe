import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import { ZodError } from 'zod';
import { validateCreateBudgetResponse } from './schemas/rpc-responses.schema';
import {
  type BudgetCreate,
  type BudgetDeleteResponse,
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetUpdate,
  type BudgetDetailsResponse,
  type Budget,
  type Transaction,
  type BudgetLine,
} from '@pulpe/shared';
import * as budgetMappers from './budget.mappers';
import { type Tables } from '../../types/database.types';
import * as transactionMappers from '../transaction/transaction.mappers';
import * as budgetLineMappers from '../budget-line/budget-line.mappers';
import { BudgetCalculator } from './budget.calculator';
import { BudgetValidator } from './budget.validator';
import { BudgetRepository } from './budget.repository';

interface BudgetDetailsData {
  budget: Budget;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
}

@Injectable()
export class BudgetService {
  constructor(
    @InjectPinoLogger(BudgetService.name)
    private readonly logger: PinoLogger,
    private readonly calculator: BudgetCalculator,
    private readonly validator: BudgetValidator,
    private readonly repository: BudgetRepository,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetListResponse> {
    try {
      const { data: budgets, error } = await supabase
        .from('monthly_budget')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          undefined,
          {
            operation: 'listBudgets',
            userId: user.id,
            entityType: 'budget',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      // Enrichir chaque budget avec le calcul du 'remaining'
      const enrichedBudgets = await this.enrichBudgetsWithRemaining(
        budgets || [],
        supabase,
      );

      const apiData = budgetMappers.toApiList(enrichedBudgets);

      return {
        success: true as const,
        data: apiData,
      } as BudgetListResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'listBudgets',
          userId: user.id,
          entityType: 'budget',
        },
      );
    }
  }

  async create(
    createBudgetDto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const validatedDto = this.validator.validateBudgetInput(createBudgetDto);

      await this.validator.validateNoDuplicatePeriod(
        supabase,
        validatedDto.month,
        validatedDto.year,
      );

      const processedResult = await this.createBudgetFromTemplate(
        validatedDto,
        user,
        supabase,
      );

      await this.calculator.recalculateAndPersist(
        processedResult.budgetData.id,
        supabase,
      );

      const apiData = budgetMappers.toApi(processedResult.budgetData);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        undefined,
        {
          operation: 'createBudget',
          userId: user.id,
          entityType: 'budget',
        },
      );
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const budgetDb = await this.repository.fetchBudgetById(
        id,
        user,
        supabase,
      );
      const apiData = budgetMappers.toApi(budgetDb as Tables<'monthly_budget'>);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'getBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
        },
      );
    }
  }

  async findOneWithDetails(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    try {
      const budgetData = await this.validateBudgetExists(budgetId, supabase);
      const responseData = await this.buildDetailsResponse(
        budgetId,
        budgetData,
        supabase,
      );
      await this.addRolloverToBudget(budgetId, responseData, supabase);

      this.logBudgetDetailsFetch(budgetId, responseData);

      return {
        success: true,
        data: responseData,
      } as BudgetDetailsResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'getBudgetWithDetails',
          userId: user.id,
          entityId: budgetId,
          entityType: 'budget',
        },
      );
    }
  }

  private async validateBudgetExists(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const budgetResult = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', budgetId)
      .single();

    if (budgetResult.error || !budgetResult.data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: budgetId },
        {
          operation: 'getBudgetWithDetails',
          entityId: budgetId,
          entityType: 'budget',
          supabaseError: budgetResult.error,
        },
      );
    }

    return budgetResult.data;
  }

  private async buildDetailsResponse(
    budgetId: string,
    budgetData: Tables<'monthly_budget'>,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const results = await this.repository.fetchBudgetData(budgetId, supabase, {
      selectFields: '*',
      orderTransactions: true,
    });

    results.budget = budgetData;

    return {
      budget: budgetMappers.toApi(results.budget as Tables<'monthly_budget'>),
      transactions: transactionMappers.toApiList(results.transactions || []),
      budgetLines: budgetLineMappers.toApiList(results.budgetLines || []),
    };
  }

  private async addRolloverToBudget(
    budgetId: string,
    responseData: BudgetDetailsData,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const rolloverData = await this.calculator.getRollover(budgetId, supabase);

    responseData.budget = {
      ...responseData.budget,
      rollover: rolloverData.rollover,
      previousBudgetId: rolloverData.previousBudgetId,
    };
  }

  private logBudgetDetailsFetch(
    budgetId: string,
    responseData: BudgetDetailsData,
  ) {
    this.logger.info(
      {
        budgetId,
        transactionCount: responseData.transactions.length,
        budgetLineCount: responseData.budgetLines.length,
        operation: 'budget.details.fetched',
      },
      'Budget avec détails récupéré avec succès',
    );
  }

  async update(
    id: string,
    updateBudgetDto: BudgetUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      await this.validateAndPrepareUpdate(id, updateBudgetDto, supabase);
      const budgetDb = await this.repository.updateBudgetInDb(
        id,
        updateBudgetDto,
        supabase,
      );

      await this.calculator.recalculateAndPersist(id, supabase);

      const apiData = budgetMappers.toApi(budgetDb as Tables<'monthly_budget'>);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'updateBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
        },
      );
    }
  }

  private async validateAndPrepareUpdate(
    id: string,
    updateBudgetDto: BudgetUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const validatedDto =
      this.validator.validateUpdateBudgetDto(updateBudgetDto);

    if (validatedDto.month && validatedDto.year) {
      await this.validator.validateNoDuplicatePeriod(
        supabase,
        validatedDto.month,
        validatedDto.year,
        id,
      );
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDeleteResponse> {
    try {
      const { error } = await supabase
        .from('monthly_budget')
        .delete()
        .eq('id', id);

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
          { id },
          {
            operation: 'deleteBudget',
            userId: user.id,
            entityId: id,
            entityType: 'budget',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      return {
        success: true,
        message: 'Budget deleted successfully',
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'deleteBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
        },
      );
    }
  }

  private async createBudgetFromTemplate(
    validatedDto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const startTime = Date.now();

    this.logger.info(
      {
        userId: user.id,
        templateId: validatedDto.templateId,
        period: `${validatedDto.month}/${validatedDto.year}`,
        operation: 'budget.create.start',
      },
      'Starting budget creation from template',
    );

    const result = await this.executeBudgetCreationRpc(
      validatedDto,
      user,
      supabase,
    );

    const processedResult = this.processBudgetCreationResult(
      result,
      user.id,
      validatedDto.templateId!,
    );

    this.logger.info(
      {
        userId: user.id,
        budgetId: processedResult.budgetData.id,
        templateId: validatedDto.templateId,
        templateName: processedResult.templateName,
        period: `${validatedDto.month}/${validatedDto.year}`,
        linesCreated: processedResult.budgetLinesCreated,
        duration: Date.now() - startTime,
        operation: 'budget.create.success',
      },
      'Budget créé depuis template avec transaction atomique',
    );

    return processedResult;
  }

  async recalculateBalances(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    await this.calculator.recalculateAndPersist(budgetId, supabase);
  }

  private async executeBudgetCreationRpc(
    validatedDto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data: result, error } = await supabase.rpc(
      'create_budget_from_template',
      {
        p_user_id: user.id,
        p_template_id: validatedDto.templateId!,
        p_month: validatedDto.month,
        p_year: validatedDto.year,
        p_description: validatedDto.description,
      },
    );

    if (error) {
      this.handleBudgetCreationError(error, user.id, validatedDto.templateId!);
    }

    return result;
  }

  private handleBudgetCreationError(
    error: unknown,
    userId: string,
    templateId: string,
  ): never {
    this.logger.error(
      {
        err: error,
        userId,
        templateId,
        operation: 'create_budget_from_template_rpc',
      },
      'Supabase RPC failed at database level',
    );

    const businessException = this.mapPostgreSQLErrorToBusinessException(
      error,
      userId,
      templateId,
    );

    throw businessException;
  }

  private mapPostgreSQLErrorToBusinessException(
    error: unknown,
    userId: string,
    templateId: string,
  ): BusinessException {
    const errorObj = error as { code?: string; message?: string };
    const errorCode = errorObj?.code;
    const errorMessage = errorObj?.message || '';

    // Handle PostgreSQL constraint violations
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

    // Handle custom exceptions or template access issues
    if (
      errorCode === 'P0001' ||
      errorMessage.includes('Template not found') ||
      errorMessage.includes('access denied')
    ) {
      return new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
        id: templateId,
      });
    }

    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
      undefined,
      { userId, templateId },
      { cause: error },
    );
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
        this.logger.error(
          {
            userId,
            templateId,
            result,
            validationErrors: error.errors,
            operation: 'processBudgetCreationResult.validation',
          },
          'RPC response validation failed',
        );

        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
          { reason: 'Invalid result structure from RPC' },
          {
            userId,
            templateId,
            validationErrors: error.errors,
            operation: 'processBudgetCreationResult',
          },
        );
      }
      throw error;
    }
  }

  /**
   * Enrichit chaque budget avec le calcul du 'remaining'
   * Calcule remaining = endingBalance + rollover depuis les données stockées
   */
  private async enrichBudgetsWithRemaining(
    budgets: Tables<'monthly_budget'>[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<(Tables<'monthly_budget'> & { remaining: number })[]> {
    const enrichedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        try {
          // Calculer le remaining pour ce budget
          const remaining = await this.calculateRemainingForBudget(
            budget,
            supabase,
          );

          return {
            ...budget,
            remaining,
          };
        } catch (error) {
          this.logger.warn(
            {
              budgetId: budget.id,
              month: budget.month,
              year: budget.year,
              error: error instanceof Error ? error.message : String(error),
              operation: 'enrichBudgetsWithRemaining',
            },
            'Failed to calculate remaining for budget, using fallback',
          );

          // Fallback: utiliser endingBalance ou 0 si pas disponible
          return {
            ...budget,
            remaining: budget.ending_balance ?? 0,
          };
        }
      }),
    );

    return enrichedBudgets;
  }

  /**
   * Calcule le 'remaining' pour un budget spécifique
   * Formule simple: remaining = endingBalance + rollover
   */
  private async calculateRemainingForBudget(
    budget: Tables<'monthly_budget'>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const rolloverData = await this.calculator.getRollover(budget.id, supabase);
    const endingBalanceStored = budget.ending_balance ?? 0;
    return endingBalanceStored + rolloverData.rollover;
  }
}
