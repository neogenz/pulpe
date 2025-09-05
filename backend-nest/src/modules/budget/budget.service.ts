import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import {
  type BudgetCreate,
  type BudgetDeleteResponse,
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetUpdate,
  type BudgetDetailsResponse,
  type BudgetLine,
} from '@pulpe/shared';
import * as budgetMappers from './budget.mappers';
import { type Tables } from '../../types/database.types';
import { BUDGET_CONSTANTS, type MonthRange } from './budget.constants';
import * as transactionMappers from '../transaction/transaction.mappers';
import * as budgetLineMappers from '../budget-line/budget-line.mappers';

@Injectable()
export class BudgetService {
  constructor(
    @InjectPinoLogger(BudgetService.name)
    private readonly logger: PinoLogger,
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

      const apiData = budgetMappers.toApiList(budgets || []);

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

  private validateRequiredFields(createBudgetDto: BudgetCreate): void {
    if (
      !createBudgetDto.month ||
      !createBudgetDto.year ||
      !createBudgetDto.description ||
      !createBudgetDto.templateId
    ) {
      const missingFields = [];
      if (!createBudgetDto.month) missingFields.push('month');
      if (!createBudgetDto.year) missingFields.push('year');
      if (!createBudgetDto.description) missingFields.push('description');
      if (!createBudgetDto.templateId) missingFields.push('templateId');

      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: missingFields,
      });
    }
  }

  private validateMonthAndYear(createBudgetDto: BudgetCreate): void {
    if (
      createBudgetDto.month < BUDGET_CONSTANTS.MONTH_MIN ||
      createBudgetDto.month > BUDGET_CONSTANTS.MONTH_MAX
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Month must be between ${BUDGET_CONSTANTS.MONTH_MIN} and ${BUDGET_CONSTANTS.MONTH_MAX}`,
      });
    }

    if (
      createBudgetDto.year < BUDGET_CONSTANTS.MIN_YEAR ||
      createBudgetDto.year > BUDGET_CONSTANTS.MAX_YEAR
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Year must be between ${BUDGET_CONSTANTS.MIN_YEAR} and ${BUDGET_CONSTANTS.MAX_YEAR}`,
      });
    }
  }

  private validateDescriptionAndFutureDate(
    createBudgetDto: BudgetCreate,
  ): void {
    if (
      createBudgetDto.description.length >
      BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Description cannot exceed ${BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH} characters`,
      });
    }

    // Validation métier : pas plus de 2 ans dans le futur
    const now = new Date();
    const budgetDate = new Date(
      createBudgetDto.year,
      createBudgetDto.month - 1,
    );
    const maxFutureDate = new Date(now.getFullYear() + 2, now.getMonth());
    if (budgetDate > maxFutureDate) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: 'Budget date cannot be more than 2 years in the future',
      });
    }
  }

  private validateCreateBudgetDto(createBudgetDto: BudgetCreate): BudgetCreate {
    // Validation métier basique (Supabase gère les contraintes de DB)
    this.validateRequiredFields(createBudgetDto);
    this.validateMonthAndYear(createBudgetDto);
    this.validateDescriptionAndFutureDate(createBudgetDto);

    return createBudgetDto;
  }

  async create(
    createBudgetDto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const validatedDto = this.validateCreateBudgetDto(createBudgetDto);

      await this.validateNoDuplicatePeriod(
        supabase,
        validatedDto.month,
        validatedDto.year,
      );

      const processedResult = await this.createBudgetFromTemplate(
        validatedDto,
        user,
        supabase,
      );

      await this.recalculateBalances(processedResult.budgetData.id, supabase);

      const apiData = budgetMappers.toApi(processedResult.budgetData);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      this.handleCreateError(error, user.id);
    }
  }

  private async createBudgetFromTemplate(
    validatedDto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    this.logBudgetCreationStart(user.id, validatedDto);

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

    this.logBudgetCreationSuccess(
      user.id,
      processedResult,
      validatedDto.templateId!,
    );

    return processedResult;
  }

  private handleCreateError(error: unknown, userId: string): never {
    handleServiceError(
      error,
      ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
      undefined,
      {
        operation: 'createBudget',
        userId,
        entityType: 'budget',
      },
    );
  }

  private logBudgetCreationStart(
    userId: string,
    validatedDto: BudgetCreate,
  ): void {
    this.logger.info(
      {
        userId,
        templateId: validatedDto.templateId,
        month: validatedDto.month,
        year: validatedDto.year,
      },
      'Starting atomic budget creation from template',
    );
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
    // Pattern "Enrichir et Relancer" - log technique + throw métier
    // Log l'erreur technique de bas niveau (Supabase RPC)
    this.logger.error(
      {
        err: error,
        userId,
        templateId,
        operation: 'create_budget_from_template_rpc',
        postgresError: error,
      },
      'Supabase RPC failed at database level',
    );

    // Throw erreur métier de haut niveau
    const errorMessage = (error as { message?: string })?.message;
    if (
      errorMessage?.includes('Template not found') ||
      errorMessage?.includes('access denied')
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
        id: templateId,
      });
    }
    if (errorMessage?.includes('Budget already exists')) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        undefined,
        { userId, templateId },
      );
    }

    throw new BusinessException(
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
    if (!result || typeof result !== 'object' || !('budget' in result)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
        { reason: 'Invalid result structure from RPC' },
        {
          userId,
          templateId,
          result,
          operation: 'processBudgetCreationResult',
        },
      );
    }

    const typedResult = result as {
      budget: Tables<'monthly_budget'>;
      budget_lines_created: number;
      template_name: string;
    };
    return {
      budgetData: typedResult.budget as Tables<'monthly_budget'>,
      budgetLinesCreated: typedResult.budget_lines_created as number,
      templateName: typedResult.template_name as string,
    };
  }

  private logBudgetCreationSuccess(
    userId: string,
    processedResult: ReturnType<typeof this.processBudgetCreationResult>,
    templateId: string,
  ): void {
    this.logger.info(
      {
        userId,
        budgetId: processedResult.budgetData.id,
        templateId,
        templateName: processedResult.templateName,
        budgetLinesCreated: processedResult.budgetLinesCreated,
      },
      'Successfully created budget from template with atomic transaction',
    );
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const budgetDb = await this.fetchBudgetById(id, user, supabase);
      const apiData = budgetMappers.toApi(budgetDb as Tables<'monthly_budget'>);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      this.handleBudgetFindOneError(error, id, user);
    }
  }

  private async fetchBudgetById(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data: budgetDb, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !budgetDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'getBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
      );
    }

    return budgetDb;
  }

  private handleBudgetFindOneError(
    error: unknown,
    id: string,
    user: AuthenticatedUser,
  ): never {
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

  async findOneWithDetails(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    try {
      const results = await this.fetchBudgetDetailsData(budgetId, supabase);
      this.validateBudgetAccess(results.budgetResult, budgetId);

      const responseData = this.mapBudgetDetailsData(results);

      const rolloverData = await this.getBudgetRollover(budgetId, supabase);

      // Construire rollover line si nécessaire
      if (rolloverData.rollover !== 0) {
        const rolloverLine = this.buildRolloverLineFromData(
          responseData.budget,
          rolloverData.rollover,
          rolloverData.previousBudgetId,
        );
        responseData.budgetLines.push(rolloverLine);
      }

      this.logBudgetDetailsFetchSuccess(budgetId, responseData);

      return {
        success: true,
        data: {
          ...responseData,
        },
      } as BudgetDetailsResponse;
    } catch (error) {
      this.handleFindOneWithDetailsError(error, user, budgetId);
    }
  }

  /**
   * Construit une ligne de rollover depuis les données pré-calculées
   * @param budget - Budget courant
   * @param rolloverAmount - Montant du rollover (déjà calculé par RPC)
   * @param previousBudgetId - ID du budget précédent d'où provient le rollover
   * @returns BudgetLine de rollover
   */
  private buildRolloverLineFromData(
    budget: {
      id: string;
      month: number;
      year: number;
      createdAt: string;
      updatedAt: string;
    },
    rolloverAmount: number,
    previousBudgetId: string | null,
  ): BudgetLine {
    const { month: prevMonth, year: prevYear } =
      budget.month === 1
        ? { month: 12, year: budget.year - 1 }
        : { month: budget.month - 1, year: budget.year };

    return {
      id: BUDGET_CONSTANTS.ROLLOVER.formatId(budget.id),
      budgetId: budget.id,
      templateLineId: null,
      savingsGoalId: null,
      name: BUDGET_CONSTANTS.ROLLOVER.formatName(
        prevMonth as MonthRange,
        prevYear,
      ),
      amount: Math.abs(rolloverAmount),
      kind: rolloverAmount > 0 ? 'income' : 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: false,
      isRollover: true,
      rolloverSourceBudgetId: previousBudgetId,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }

  private handleFindOneWithDetailsError(
    error: unknown,
    user: AuthenticatedUser,
    id: string,
  ): never {
    handleServiceError(
      error,
      ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
      undefined,
      {
        operation: 'getBudgetWithDetails',
        userId: user.id,
        entityId: id,
        entityType: 'budget',
      },
    );
  }

  private async fetchBudgetDetailsData(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const [budgetResult, transactionsResult, budgetLinesResult] =
      await Promise.all([
        supabase.from('monthly_budget').select('*').eq('id', id).single(),
        supabase
          .from('transaction')
          .select('*')
          .eq('budget_id', id)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('budget_line')
          .select('*')
          .eq('budget_id', id)
          .order('created_at', { ascending: false }),
      ]);

    return { budgetResult, transactionsResult, budgetLinesResult };
  }

  private validateBudgetAccess(
    budgetResult: { error?: unknown; data?: unknown },
    id: string,
  ): void {
    if (budgetResult.error || !budgetResult.data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'validateBudgetAccess',
          entityId: id,
          entityType: 'budget',
          supabaseError: budgetResult.error,
        },
      );
    }
  }

  private mapBudgetDetailsData(
    results: ReturnType<typeof this.fetchBudgetDetailsData> extends Promise<
      infer T
    >
      ? T
      : never,
  ) {
    const budget = budgetMappers.toApi(
      results.budgetResult.data as Tables<'monthly_budget'>,
    );

    const transactions = transactionMappers.toApiList(
      results.transactionsResult.data || [],
    );

    const budgetLines = budgetLineMappers.toApiList(
      results.budgetLinesResult.data || [],
    );

    return {
      budget,
      transactions,
      budgetLines,
    };
  }

  private logBudgetDetailsFetchSuccess(
    id: string,
    mappedData: ReturnType<typeof this.mapBudgetDetailsData>,
  ): void {
    this.logger.info(
      {
        budgetId: id,
        transactionCount: mappedData.transactions.length,
        budgetLineCount: mappedData.budgetLines.length,
      },
      'Successfully fetched budget with details',
    );
  }

  private validateUpdateBudgetDto(updateBudgetDto: BudgetUpdate): BudgetUpdate {
    // Validation basique pour les champs optionnels
    if (
      updateBudgetDto.month !== undefined &&
      (updateBudgetDto.month < BUDGET_CONSTANTS.MONTH_MIN ||
        updateBudgetDto.month > BUDGET_CONSTANTS.MONTH_MAX)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Month must be between ${BUDGET_CONSTANTS.MONTH_MIN} and ${BUDGET_CONSTANTS.MONTH_MAX}`,
      });
    }

    if (
      updateBudgetDto.year !== undefined &&
      (updateBudgetDto.year < BUDGET_CONSTANTS.MIN_YEAR ||
        updateBudgetDto.year > BUDGET_CONSTANTS.MAX_YEAR)
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.VALIDATION_FAILED, {
        reason: `Year must be between ${BUDGET_CONSTANTS.MIN_YEAR} and ${BUDGET_CONSTANTS.MAX_YEAR}`,
      });
    }

    return updateBudgetDto;
  }

  private prepareBudgetUpdateData(updateBudgetDto: BudgetUpdate) {
    return {
      ...updateBudgetDto,
    };
  }

  private async updateBudgetInDb(
    id: string,
    updateData: ReturnType<typeof this.prepareBudgetUpdateData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data: budgetDb, error } = await supabase
      .from('monthly_budget')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !budgetDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'updateBudgetInDb',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return budgetDb;
  }

  async update(
    id: string,
    updateBudgetDto: BudgetUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const validatedDto = this.validateUpdateBudgetDto(updateBudgetDto);

      if (validatedDto.month && validatedDto.year) {
        await this.validateNoDuplicatePeriod(
          supabase,
          validatedDto.month,
          validatedDto.year,
          id,
        );
      }

      const updateData = this.prepareBudgetUpdateData(updateBudgetDto);
      const budgetDb = await this.updateBudgetInDb(id, updateData, supabase);

      await this.recalculateBalances(id, supabase);

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

  private async validateNoDuplicatePeriod(
    supabase: AuthenticatedSupabaseClient,
    month: number,
    year: number,
    excludeId?: string,
  ): Promise<void> {
    const { data: existingBudget } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .neq('id', excludeId || '')
      .single();

    if (existingBudget) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_ALREADY_EXISTS_FOR_MONTH,
        { month, year },
      );
    }
  }

  private async calculateMonthlyEndingBalance(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { budgetLines, transactions } = await this.fetchBudgetData(
      budgetId,
      supabase,
    );

    const allMonthlyItems = [...budgetLines, ...transactions];
    const { totalMonthlyIncome, totalMonthlyExpenses } = allMonthlyItems.reduce(
      (acc, item) => {
        if (item.kind === 'income') {
          acc.totalMonthlyIncome += item.amount;
        } else {
          acc.totalMonthlyExpenses += item.amount;
        }
        return acc;
      },
      { totalMonthlyIncome: 0, totalMonthlyExpenses: 0 },
    );

    return totalMonthlyIncome - totalMonthlyExpenses;
  }

  private async persistEndingBalanceOnly(
    budgetId: string,
    endingBalance: number,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase
      .from('monthly_budget')
      .update({
        ending_balance: endingBalance,
      })
      .eq('id', budgetId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_UPDATE_FAILED,
        { budgetId },
        {
          operation: 'persistEndingBalanceOnly',
          entityId: budgetId,
          entityType: 'monthly_budget',
        },
        { cause: error },
      );
    }

    this.logger.info(
      {
        budgetId,
        endingBalance,
        operation: 'persistEndingBalanceOnly',
      },
      'Ending balance calculated and persisted',
    );
  }

  /**
   * Fetches budget lines and transactions for a given budget
   * @param budgetId - The budget ID to fetch data for
   * @param supabase - Authenticated Supabase client
   * @returns Budget lines and transactions arrays
   */
  private async fetchBudgetData(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{
    budgetLines: Array<{ kind: string; amount: number }>;
    transactions: Array<{ kind: string; amount: number }>;
  }> {
    const [budgetLinesResult, transactionsResult] = await Promise.all([
      supabase
        .from('budget_line')
        .select('kind, amount')
        .eq('budget_id', budgetId),
      supabase
        .from('transaction')
        .select('kind, amount')
        .eq('budget_id', budgetId),
    ]);

    this.validateFetchResults(budgetId, budgetLinesResult, transactionsResult);

    return {
      budgetLines: Array.isArray(budgetLinesResult.data)
        ? budgetLinesResult.data
        : [],
      transactions: Array.isArray(transactionsResult.data)
        ? transactionsResult.data
        : [],
    };
  }

  /**
   * Validates fetch results and throws appropriate exceptions
   */
  private validateFetchResults(
    budgetId: string,
    budgetLinesResult: { error?: unknown; data?: unknown },
    transactionsResult: { error?: unknown; data?: unknown },
  ): void {
    if (budgetLinesResult.error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        { budgetId },
        {
          operation: 'calculateAvailableToSpend',
          entityId: budgetId,
          entityType: 'budget_line',
        },
        { cause: budgetLinesResult.error },
      );
    }

    if (transactionsResult.error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        { budgetId },
        {
          operation: 'calculateAvailableToSpend',
          entityId: budgetId,
          entityType: 'transaction',
        },
        { cause: transactionsResult.error },
      );
    }
  }

  /**
   * Gets rollover amount and previous budget ID from previous months
   * @param budgetId - Budget ID to get rollover for
   * @param supabase - Authenticated Supabase client
   * @returns Rollover amount and previous budget ID from previous months
   */
  private async getBudgetRollover(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_budget_with_rollover', { p_budget_id: budgetId })
        .single();

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          { budgetId },
          {
            operation: 'getBudgetRollover',
            entityId: budgetId,
            entityType: 'budget',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      if (!data) {
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
          id: budgetId,
        });
      }

      return {
        rollover: (data as { rollover?: number }).rollover ?? 0,
        previousBudgetId:
          (data as { previous_budget_id?: string }).previous_budget_id ?? null,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'getBudgetRollover',
          entityId: budgetId,
          entityType: 'budget',
        },
      );
    }
  }

  /**
   * Recalculates and persists ending balance (simplified architecture)
   * @param budgetId - The budget ID that was modified
   * @param supabase - Authenticated Supabase client
   */
  async recalculateBalances(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const endingBalance = await this.calculateMonthlyEndingBalance(
      budgetId,
      supabase,
    );
    await this.persistEndingBalanceOnly(budgetId, endingBalance, supabase);
  }
}
