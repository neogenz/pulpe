import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable, HttpException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
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
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'listBudgets',
          userId: user.id,
          entityType: 'budget',
        },
        { cause: error },
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
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
      undefined,
      {
        operation: 'createBudget',
        userId,
        entityType: 'budget',
      },
      { cause: error },
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
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
      undefined,
      {
        operation: 'getBudget',
        userId: user.id,
        entityId: id,
        entityType: 'budget',
      },
      { cause: error },
    );
  }

  async findOneWithDetails(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    try {
      const results = await this.fetchBudgetDetailsData(id, supabase);
      this.validateBudgetAccess(results.budgetResult, id);
      this.logDataFetchErrors(results, id);

      const mappedData = this.mapBudgetDetailsData(results);
      await this.addRolloverToBudgetLines(
        mappedData,
        results.budgetResult,
        user,
        supabase,
      );
      const summary = await this.calculateBudgetSummary(id, supabase);

      this.logBudgetDetailsFetchSuccess(id, mappedData);

      return {
        success: true,
        data: {
          ...mappedData,
          summary,
        },
      } as BudgetDetailsResponse;
    } catch (error) {
      this.handleFindOneWithDetailsError(error, user, id);
    }
  }

  private async addRolloverToBudgetLines(
    mappedData: { budgetLines: BudgetLine[] },
    budgetResult: { data: unknown },
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    // Add rollover from previous month
    const rolloverLine = await this.calculateRolloverLine(
      budgetResult.data as Tables<'monthly_budget'>,
      user,
      supabase,
    );

    if (rolloverLine) {
      mappedData.budgetLines.push(rolloverLine);
    }
  }

  private async calculateBudgetSummary(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const summaryData = await this.calculateAvailableToSpend(id, supabase);
    return {
      endingBalance: summaryData.endingBalance,
      rollover: summaryData.rollover,
      rolloverBalance: summaryData.rolloverBalance,
      availableToSpend: summaryData.availableToSpend,
    };
  }

  private handleFindOneWithDetailsError(
    error: unknown,
    user: AuthenticatedUser,
    id: string,
  ): never {
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
      undefined,
      {
        operation: 'getBudgetWithDetails',
        userId: user.id,
        entityId: id,
        entityType: 'budget',
      },
      { cause: error },
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

  private logDataFetchErrors(
    results: ReturnType<typeof this.fetchBudgetDetailsData> extends Promise<
      infer T
    >
      ? T
      : never,
    id: string,
  ): void {
    // Ces erreurs sont non-bloquantes, on les log seulement
    // (la fonction continue même si certaines données manquent)
    if (results.transactionsResult.error) {
      this.logger.error(
        { err: results.transactionsResult.error, budgetId: id },
        'Failed to fetch transactions for budget',
      );
    }

    if (results.budgetLinesResult.error) {
      this.logger.error(
        { err: results.budgetLinesResult.error, budgetId: id },
        'Failed to fetch budget lines for budget',
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

      const apiData = budgetMappers.toApi(budgetDb as Tables<'monthly_budget'>);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'updateBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
        },
        { cause: error },
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
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'deleteBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
        },
        { cause: error },
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

  /**
   * Calculates the rollover line from the previous month's Available to Spend
   * Returns null if this is the first budget month for the user or if calculation fails
   */
  private async calculateRolloverLine(
    currentBudget: Tables<'monthly_budget'>,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLine | null> {
    try {
      const previousBudget = await this.findPreviousBudget(
        currentBudget,
        user,
        supabase,
      );

      if (!previousBudget) {
        return null;
      }

      const previousBudgetAvailableToSpend =
        await this.calculateAvailableToSpendInternal(
          previousBudget.id,
          supabase,
          true,
        );

      return this.buildRolloverLine(currentBudget, user, {
        budget: previousBudget,
        availableToSpend: previousBudgetAvailableToSpend,
      });
    } catch (error) {
      // Inline logging for better readability and fewer methods
      this.logger.error(
        {
          userId: user.id,
          currentBudgetId: currentBudget.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Failed to calculate rollover line - budget will load without rollover',
      );
      return null;
    }
  }

  /**
   * Prepares rollover data by fetching previous budget and calculating available to spend
   */
  private async findPreviousBudget(
    currentBudget: Tables<'monthly_budget'>,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'monthly_budget'> | null> {
    const { month: prevMonth, year: prevYear } = this.getPreviousMonthYear(
      currentBudget.month,
      currentBudget.year,
    );

    const previousBudget = await this.fetchBudgetByMonthAndYear(
      prevMonth,
      prevYear,
      user.id,
      supabase,
    );

    if (!previousBudget) {
      // Inline logging - no need for separate method
      this.logger.info(
        {
          userId: user.id,
          currentBudgetId: currentBudget.id,
          prevMonth,
          prevYear,
        },
        'No previous budget found for rollover calculation',
      );
      return null;
    }

    return previousBudget;
  }

  /**
   * Builds the rollover line from prepared data
   */
  private buildRolloverLine(
    currentBudget: Tables<'monthly_budget'>,
    user: AuthenticatedUser,
    rolloverData: {
      budget: Tables<'monthly_budget'>;
      availableToSpend: number;
    },
  ): BudgetLine | null {
    const { budget, availableToSpend } = rolloverData;

    // Don't create rollover line if amount is zero
    if (availableToSpend === 0) {
      this.logger.info(
        {
          userId: user.id,
          currentBudgetId: currentBudget.id,
          previousBudgetId: budget.id,
        },
        'No rollover line created - zero balance',
      );
      return null;
    }

    const rolloverLine = this.createRolloverBudgetLine(
      currentBudget,
      budget,
      availableToSpend,
    );

    // Inline logging for better code flow
    this.logger.info(
      {
        userId: user.id,
        currentBudgetId: currentBudget.id,
        previousBudgetId: budget.id,
        rolloverAmount: availableToSpend,
        rolloverKind: rolloverLine.kind,
      },
      'Calculated rollover from previous month',
    );

    return rolloverLine;
  }

  private createRolloverBudgetLine(
    nextBudget: Tables<'monthly_budget'>,
    rolloverBudget: Tables<'monthly_budget'>,
    availableToSpendAmount: number,
  ): BudgetLine {
    const id = BUDGET_CONSTANTS.ROLLOVER.formatId(nextBudget.id);
    const name = BUDGET_CONSTANTS.ROLLOVER.formatName(
      rolloverBudget.month as MonthRange,
      rolloverBudget.year,
    );
    return {
      id,
      budgetId: nextBudget.id,
      templateLineId: null,
      savingsGoalId: null,
      name,
      amount: Math.abs(availableToSpendAmount),
      kind: availableToSpendAmount > 0 ? 'income' : 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: false,
      isRollover: true,
      rolloverSourceBudgetId: rolloverBudget.id,
      createdAt: nextBudget.created_at,
      updatedAt: nextBudget.updated_at,
    };
  }

  /**
   * Calculates and persists both ending_balance and rollover_balance
   * ending_balance = Income - Expenses - Transactions (pure month balance, no rollover)
   * rollover_balance = previous rollover_balance + ending_balance (cumulative total)
   * @param budgetId - The budget ID to calculate for
   * @param supabase - Authenticated Supabase client
   * @returns The ending balance calculated and saved
   */
  async calculateAndPersistEndingBalance(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const endingBalance = await this.calculateMonthlyEndingBalance(
      budgetId,
      supabase,
    );
    await this.persistBudgetBalances(budgetId, endingBalance, supabase);
    await this.propagateToNextMonth(budgetId, supabase);

    return endingBalance;
  }

  private async calculateMonthlyEndingBalance(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    // MÉTIER: Calculate pure month balance (budget_lines + transactions du mois uniquement)
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

    // MÉTIER: ending_balance = revenus - dépenses du mois (sans rollover)
    return totalMonthlyIncome - totalMonthlyExpenses;
  }

  private async persistBudgetBalances(
    budgetId: string,
    endingBalance: number,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    // MÉTIER: rollover_balance = rollover_balance_précédent + ending_balance_actuel
    const previousRolloverBalance = await this.getRolloverFromPreviousMonth(
      budgetId,
      supabase,
    );
    const cumulativeRolloverBalance = previousRolloverBalance + endingBalance;

    // Persist both values
    const { error } = await supabase
      .from('monthly_budget')
      .update({
        ending_balance: endingBalance,
        rollover_balance: cumulativeRolloverBalance,
      })
      .eq('id', budgetId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_UPDATE_FAILED,
        { budgetId },
        {
          operation: 'calculateAndPersistEndingBalance',
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
        previousRolloverBalance,
        cumulativeRolloverBalance,
        operation: 'calculateAndPersistEndingBalance',
      },
      'Ending balance and rollover balance calculated and persisted',
    );
  }

  /**
   * Propagates changes to the following month (N+1)
   * When current month's ending_balance changes, the next month's rollover changes too
   * @param currentBudgetId - Current budget ID that was updated
   * @param supabase - Authenticated Supabase client
   */
  private async propagateToNextMonth(
    currentBudgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    try {
      const nextBudget = await this.findNextMonthBudget(
        currentBudgetId,
        supabase,
      );

      if (nextBudget) {
        await this.recalculateNextMonthBalance(
          currentBudgetId,
          nextBudget,
          supabase,
        );
      }
    } catch (error) {
      this.logPropagationError(currentBudgetId, error);
    }
  }

  private async findNextMonthBudget(
    currentBudgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    // Get current budget info for next month calculation
    const currentBudget = await this.getCurrentBudgetForRollover(
      currentBudgetId,
      supabase,
    );

    if (!currentBudget) {
      return null; // No current budget found, nothing to propagate
    }

    // Find next month budget
    const { month: nextMonth, year: nextYear } = this.getNextMonthYear(
      currentBudget.month,
      currentBudget.year,
    );

    const nextBudget = await this.fetchBudgetByMonthAndYear(
      nextMonth,
      nextYear,
      currentBudget.user_id,
      supabase,
    );

    if (!nextBudget) {
      // No next month budget exists, nothing to propagate
      this.logger.info(
        {
          currentBudgetId,
          nextMonth,
          nextYear,
          userId: currentBudget.user_id,
        },
        'No next month budget found for propagation',
      );
      return null;
    }

    return { currentBudget, nextBudget, nextMonth, nextYear };
  }

  private async recalculateNextMonthBalance(
    currentBudgetId: string,
    budgetInfo: {
      currentBudget: { id: string; month: number; year: number };
      nextBudget: { id: string };
      nextMonth: number;
      nextYear: number;
    },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { currentBudget, nextBudget, nextMonth, nextYear } = budgetInfo;

    // Recalculate next month's ending balance (will include updated rollover)
    // Use internal method to avoid infinite propagation
    await this.calculateAndPersistEndingBalanceInternal(
      nextBudget.id,
      supabase,
    );

    this.logger.info(
      {
        currentBudgetId,
        nextBudgetId: nextBudget.id,
        currentMonth: `${currentBudget.month}/${currentBudget.year}`,
        nextMonth: `${nextMonth}/${nextYear}`,
      },
      'Successfully propagated ending balance to next month',
    );
  }

  private logPropagationError(currentBudgetId: string, error: unknown): void {
    // Log error but don't throw - propagation failure shouldn't break main operation
    this.logger.warn(
      {
        currentBudgetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'Failed to propagate to next month - proceeding without propagation',
    );
  }

  /**
   * Internal method to calculate ending balance and rollover balance without N+1 propagation
   * Used by propagateToNextMonth to avoid infinite recursion
   */
  private async calculateAndPersistEndingBalanceInternal(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const endingBalance = await this.calculateMonthlyEndingBalance(
      budgetId,
      supabase,
    );
    await this.persistEndingBalanceOnly(budgetId, endingBalance, supabase);

    return endingBalance;
  }

  private async persistEndingBalanceOnly(
    budgetId: string,
    endingBalance: number,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const previousRolloverBalance = await this.getRolloverFromPreviousMonth(
      budgetId,
      supabase,
    );
    const cumulativeRolloverBalance = previousRolloverBalance + endingBalance;

    const { error } = await supabase
      .from('monthly_budget')
      .update({
        ending_balance: endingBalance,
        rollover_balance: cumulativeRolloverBalance,
      })
      .eq('id', budgetId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_UPDATE_FAILED,
        { budgetId },
        {
          operation: 'calculateAndPersistEndingBalanceInternal',
          entityId: budgetId,
          entityType: 'monthly_budget',
        },
        { cause: error },
      );
    }
  }

  /**
   * Calculates the Available to Spend for a specific budget
   * Available to Spend = Ending Balance + Rollover from previous month
   * @param budgetId - The budget ID to calculate for
   * @param supabase - Authenticated Supabase client
   * @param includeRollover - Whether to include rollover from previous month (default: true)
   */
  private async calculateAvailableToSpendInternal(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    includeRollover = true,
  ): Promise<number> {
    // Current month ending balance (persisted, pure month balance)
    const endingBalance = await this.calculateAndPersistEndingBalance(
      budgetId,
      supabase,
    );

    if (!includeRollover) {
      return endingBalance;
    }

    // Add rollover from previous month (rollover_balance from previous month)
    const rollover = await this.getRolloverFromPreviousMonth(
      budgetId,
      supabase,
    );

    return endingBalance + rollover;
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
   * Gets the rollover amount from the previous month's rollover_balance
   * MÉTIER: Le rollover = rollover_balance du mois N-1
   * @param currentBudgetId - Current budget ID
   * @param supabase - Authenticated Supabase client
   * @returns The rollover amount from previous month, or 0 if no previous budget exists
   */
  private async getRolloverFromPreviousMonth(
    currentBudgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    try {
      const currentBudgetInfo = await this.getCurrentBudgetForRollover(
        currentBudgetId,
        supabase,
      );
      if (!currentBudgetInfo) {
        return 0;
      }

      const user = { id: currentBudgetInfo.user_id } as AuthenticatedUser;
      const previousMonthBudget = await this.findPreviousBudget(
        currentBudgetInfo as Tables<'monthly_budget'>,
        user,
        supabase,
      );

      if (!previousMonthBudget) {
        return 0; // First month for this user
      }

      // MÉTIER: rollover_N = rollover_balance_(N-1)
      // rollover_balance contains the cumulative total available for rollover
      return previousMonthBudget.rollover_balance ?? 0;
    } catch (error) {
      // Log error but don't throw - return 0 to gracefully handle rollover failures
      this.logger.warn(
        {
          budgetId: currentBudgetId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'Failed to get rollover from previous month - proceeding without rollover',
      );
      return 0;
    }
  }

  /**
   * Gets current budget basic info needed for rollover calculation
   */
  private async getCurrentBudgetForRollover(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{
    id: string;
    month: number;
    year: number;
    user_id: string;
  } | null> {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year, user_id')
      .eq('id', budgetId)
      .single();

    return error || !data || !data.user_id
      ? null
      : (data as { id: string; month: number; year: number; user_id: string });
  }

  /**
   * Fetches a user's budget for a specific month and year
   */
  private async fetchBudgetByMonthAndYear(
    month: number,
    year: number,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'monthly_budget'> | null> {
    const { data } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('month', month)
      .eq('year', year)
      .eq('user_id', userId)
      .maybeSingle();

    return data;
  }

  /**
   * Gets the previous month and year from a given month/year
   */
  private getPreviousMonthYear(
    month: number,
    year: number,
  ): { month: number; year: number } {
    return month === 1
      ? { month: 12, year: year - 1 }
      : { month: month - 1, year };
  }

  /**
   * Gets the next month and year from a given month/year
   */
  private getNextMonthYear(
    month: number,
    year: number,
  ): { month: number; year: number } {
    return month === 12
      ? { month: 1, year: year + 1 }
      : { month: month + 1, year };
  }

  /**
   * Calculates the Available to Spend for a budget using rollover_balance
   * Available to Spend = Ending Balance (current month) + Rollover (from previous month)
   * @param budgetId - The budget ID to calculate for
   * @param supabase - Authenticated Supabase client
   * @returns Complete breakdown of Available to Spend calculation
   */
  async calculateAvailableToSpend(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{
    endingBalance: number;
    rollover: number;
    rolloverBalance: number;
    availableToSpend: number;
  }> {
    // Get current budget info
    const currentBudget = await this.getCurrentBudgetForRollover(
      budgetId,
      supabase,
    );
    if (!currentBudget) {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
        id: budgetId,
      });
    }

    // Calculate current month's ending balance (and update rollover_balance)
    const endingBalance = await this.calculateAndPersistEndingBalance(
      budgetId,
      supabase,
    );

    // Get rollover from previous month (rollover_balance from N-1)
    const rollover = await this.getRolloverFromPreviousMonth(
      budgetId,
      supabase,
    );

    // Calculate current rollover_balance (cumulative total)
    const rolloverBalance = rollover + endingBalance;

    // Available to Spend = ending balance + rollover (MÉTIER: Disponible à Dépenser)
    const availableToSpend = endingBalance + rollover;

    return {
      endingBalance,
      rollover,
      rolloverBalance,
      availableToSpend,
    };
  }

  /**
   * Triggers recalculation when budget lines or transactions change
   * @param budgetId - The budget ID that was modified
   * @param supabase - Authenticated Supabase client
   */
  async onBudgetDataChanged(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    await this.calculateAndPersistEndingBalance(budgetId, supabase);
  }
}
