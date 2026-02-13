import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { CacheService } from '@modules/cache/cache.service';
import { ZodError } from 'zod';
import { validateCreateBudgetResponse } from './schemas/rpc-responses.schema';
import {
  type BudgetCreate,
  type BudgetDeleteResponse,
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetUpdate,
  type BudgetDetailsResponse,
  type BudgetExportResponse,
  type BudgetWithDetails,
  type Budget,
  type Transaction,
  type BudgetLine,
  type ListBudgetsQuery,
  type BudgetSparseListResponse,
  PAY_DAY_MIN,
  PAY_DAY_MAX,
} from 'pulpe-shared';
import * as budgetMappers from './budget.mappers';
import { type Tables } from '../../types/database.types';
import * as transactionMappers from '../transaction/transaction.mappers';
import * as budgetLineMappers from '../budget-line/budget-line.mappers';
import { BudgetCalculator } from './budget.calculator';
import { BudgetValidator } from './budget.validator';
import { BudgetRepository } from './budget.repository';
import { EncryptionService } from '@modules/encryption/encryption.service';

const DEFAULT_PAY_DAY = PAY_DAY_MIN;

interface BudgetDetailsData {
  budget: Budget;
  transactions: Transaction[];
  budgetLines: BudgetLine[];
}

@Injectable()
export class BudgetService {
  constructor(
    @InjectInfoLogger(BudgetService.name)
    private readonly logger: InfoLogger,
    private readonly calculator: BudgetCalculator,
    private readonly validator: BudgetValidator,
    private readonly repository: BudgetRepository,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: CacheService,
  ) {}

  private async getPayDayOfMonth(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { data } = await supabase.auth.getUser();
    const raw = data?.user?.user_metadata?.payDayOfMonth;

    if (typeof raw !== 'number' || !Number.isInteger(raw)) {
      return DEFAULT_PAY_DAY;
    }

    return Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, raw));
  }

  async hasBudgets(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('monthly_budget')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          undefined,
          {
            operation: 'hasBudgets',
            userId: user.id,
            entityType: 'budget',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      return data !== null;
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      throw handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'hasBudgets',
          userId: user.id,
          entityType: 'budget',
        },
      );
    }
  }

  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query?: ListBudgetsQuery,
  ): Promise<BudgetListResponse | BudgetSparseListResponse> {
    const keyParts = [
      user.clientKey.toString('hex').slice(0, 16),
      query?.fields ?? '',
      query?.limit ?? '',
      query?.year ?? '',
    ].join(':');
    const cacheKey = `budgets:list:${keyParts}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.#fetchBudgetList(user, supabase, query),
    );
  }

  async #fetchBudgetList(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query?: ListBudgetsQuery,
  ): Promise<BudgetListResponse | BudgetSparseListResponse> {
    try {
      if (query?.fields) {
        return this.findAllSparse(user, supabase, query);
      }

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

      const payDayOfMonth = await this.getPayDayOfMonth(supabase);

      const enrichedBudgets = await this.enrichBudgetsWithRemaining(
        budgets || [],
        supabase,
        payDayOfMonth,
        user.clientKey,
      );

      const apiData = budgetMappers.toApiList(enrichedBudgets);

      return {
        success: true as const,
        data: apiData,
      } as BudgetListResponse;
    } catch (error) {
      throw handleServiceError(
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

  private async findAllSparse(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query: ListBudgetsQuery,
  ): Promise<BudgetSparseListResponse> {
    const requestedFields = query.fields!.split(',').map((f) => f.trim());
    const allowedFields = [
      'month',
      'year',
      'rollover',
      'totalExpenses',
      'totalSavings',
      'totalIncome',
      'remaining',
    ];
    const invalidFields = requestedFields.filter(
      (f) => !allowedFields.includes(f),
    );
    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Unknown sparse fields: ${invalidFields.join(', ')}`,
      );
    }
    const needsAggregates = this.fieldsRequireAggregates(requestedFields);
    const needsRollover = this.fieldsRequireRollover(requestedFields);

    const budgetsList = await this.fetchBudgetsWithFilters(
      user,
      supabase,
      query,
    );
    const budgetIds = budgetsList.map((b) => b.id);

    const aggregatesMap = needsAggregates
      ? await (async () => {
          const dek = await this.encryptionService.getUserDEK(
            user.id,
            user.clientKey,
          );
          return this.repository.fetchBudgetAggregates(
            budgetIds,
            supabase,
            (amount) =>
              amount
                ? this.encryptionService.tryDecryptAmount(amount, dek, 0)
                : 0,
          );
        })()
      : new Map();

    const rolloversMap = needsRollover
      ? await this.fetchRolloversForBudgets(
          budgetsList,
          supabase,
          user.clientKey,
        )
      : new Map<string, number>();

    const sparseData = budgetsList.map((budget) =>
      budgetMappers.toSparseApi(
        budget,
        requestedFields,
        aggregatesMap.get(budget.id),
        rolloversMap.get(budget.id),
      ),
    );

    return { success: true as const, data: sparseData };
  }

  private fieldsRequireAggregates(fields: string[]): boolean {
    const aggregateFields = [
      'totalExpenses',
      'totalSavings',
      'totalIncome',
      'remaining',
    ];
    return fields.some((f) => aggregateFields.includes(f));
  }

  private fieldsRequireRollover(fields: string[]): boolean {
    return fields.includes('rollover') || fields.includes('remaining');
  }

  private async fetchBudgetsWithFilters(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    query: ListBudgetsQuery,
  ): Promise<Tables<'monthly_budget'>[]> {
    let budgetsQuery = supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (query.limit) budgetsQuery = budgetsQuery.limit(query.limit);
    if (query.year) budgetsQuery = budgetsQuery.eq('year', query.year);

    const { data: budgets, error } = await budgetsQuery;

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetsSparse',
          userId: user.id,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return budgets || [];
  }

  private async fetchRolloversForBudgets(
    budgets: Tables<'monthly_budget'>[],
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer,
  ): Promise<Map<string, number>> {
    const payDayOfMonth = await this.getPayDayOfMonth(supabase);
    const rolloversMap = new Map<string, number>();

    await Promise.all(
      budgets.map(async (budget) => {
        try {
          const rolloverData = await this.calculator.getRollover(
            budget.id,
            payDayOfMonth,
            supabase,
            clientKey,
          );
          rolloversMap.set(budget.id, rolloverData.rollover);
        } catch (error) {
          this.logger.warn(
            {
              budgetId: budget.id,
              month: budget.month,
              year: budget.year,
              err: error,
              operation: 'fetchRolloversForBudgets',
            },
            'Failed to fetch rollover for budget, using fallback of 0',
          );
          rolloversMap.set(budget.id, 0);
        }
      }),
    );

    return rolloversMap;
  }

  async exportAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetExportResponse> {
    try {
      const startTime = Date.now();
      const payDayOfMonth = await this.getPayDayOfMonth(supabase);
      const budgets = await this.fetchAllBudgetsForExport(user.id, supabase);
      const budgetsWithDetails = await this.enrichBudgetsForExport(
        budgets,
        supabase,
        payDayOfMonth,
        user.clientKey,
      );

      this.logExportSuccess(user.id, budgetsWithDetails.length, startTime);

      return this.buildExportResponse(budgetsWithDetails);
    } catch (error) {
      throw handleServiceError(
        error,
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        {
          operation: 'exportAllBudgets',
          userId: user.id,
          entityType: 'budget',
        },
      );
    }
  }

  private async fetchAllBudgetsForExport(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'monthly_budget'>[]> {
    const { data: budgets, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'exportAllBudgets',
          userId,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return budgets || [];
  }

  private async enrichBudgetsForExport(
    budgets: Tables<'monthly_budget'>[],
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<BudgetWithDetails[]> {
    return Promise.all(
      budgets.map((budget) =>
        this.enrichBudgetForExport(budget, supabase, payDayOfMonth, clientKey),
      ),
    );
  }

  private async enrichBudgetForExport(
    budget: Tables<'monthly_budget'>,
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<BudgetWithDetails> {
    const { transactions, budgetLines } = await this.repository.fetchBudgetData(
      budget.id,
      supabase,
      {
        budgetLineFields: '*',
        transactionFields: '*',
        orderTransactions: true,
      },
    );

    const rolloverData = await this.calculator.getRollover(
      budget.id,
      payDayOfMonth,
      supabase,
      clientKey,
    );
    const remaining = await this.calculateRemainingForBudget(
      budget,
      supabase,
      payDayOfMonth,
      clientKey,
    );

    const dek = await this.encryptionService.getUserDEK(
      budget.user_id!,
      clientKey,
    );

    const decryptedBudgetLines = (budgetLines || []).map((line) => {
      if (!line.amount) return { ...line, amount: 0 };
      return {
        ...line,
        amount: this.encryptionService.tryDecryptAmount(line.amount, dek, 0),
      };
    });

    const decryptedTransactions = (transactions || []).map((tx) => {
      if (!tx.amount) return { ...tx, amount: 0 };
      return {
        ...tx,
        amount: this.encryptionService.tryDecryptAmount(tx.amount, dek, 0),
      };
    });

    return {
      ...budgetMappers.toApi({
        ...budget,
        ending_balance: budget.ending_balance
          ? this.encryptionService.tryDecryptAmount(
              budget.ending_balance,
              dek,
              0,
            )
          : null,
      } as unknown as Omit<Tables<'monthly_budget'>, 'ending_balance'> & {
        ending_balance: number | null;
      }),
      rollover: rolloverData.rollover,
      previousBudgetId: rolloverData.previousBudgetId,
      remaining,
      transactions: transactionMappers.toApiList(
        decryptedTransactions as unknown as (Omit<
          Tables<'transaction'>,
          'amount'
        > & { amount: number })[],
      ),
      budgetLines: budgetLineMappers.toApiList(
        decryptedBudgetLines as unknown as (Omit<
          Tables<'budget_line'>,
          'amount'
        > & { amount: number })[],
      ),
    };
  }

  private logExportSuccess(
    userId: string,
    budgetCount: number,
    startTime: number,
  ): void {
    this.logger.info(
      {
        userId,
        budgetCount,
        duration: Date.now() - startTime,
        operation: 'budget.export.success',
      },
      'All budgets exported successfully',
    );
  }

  private buildExportResponse(
    budgetsWithDetails: BudgetWithDetails[],
  ): BudgetExportResponse {
    return {
      success: true as const,
      data: {
        exportDate: new Date().toISOString(),
        totalBudgets: budgetsWithDetails.length,
        budgets: budgetsWithDetails,
      },
    };
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
        user.clientKey,
      );

      const apiData = budgetMappers.toApi(processedResult.budgetData);

      await this.cacheService.invalidateForUser(user.id);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      throw handleServiceError(
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
      throw handleServiceError(
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
    const clientKeyHash = user.clientKey.toString('hex').slice(0, 16);
    const cacheKey = `budgets:detail:${clientKeyHash}:${budgetId}`;
    return this.cacheService.getOrSet(user.id, cacheKey, 30_000, () =>
      this.#fetchBudgetWithDetails(budgetId, user, supabase),
    );
  }

  async #fetchBudgetWithDetails(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    try {
      const payDayOfMonth = await this.getPayDayOfMonth(supabase);
      const budgetData = await this.validateBudgetExists(budgetId, supabase);
      const responseData = await this.buildDetailsResponse(
        budgetId,
        budgetData,
        supabase,
        user,
      );
      await this.addRolloverToBudget(
        budgetId,
        responseData,
        supabase,
        payDayOfMonth,
        user.clientKey,
      );

      this.logBudgetDetailsFetch(budgetId, responseData);

      return {
        success: true,
        data: responseData,
      } as BudgetDetailsResponse;
    } catch (error) {
      throw handleServiceError(
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
    user: AuthenticatedUser,
  ) {
    const results = await this.repository.fetchBudgetData(budgetId, supabase, {
      budgetLineFields: '*',
      transactionFields: '*',
      orderTransactions: true,
    });

    results.budget = budgetData;

    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );

    const decryptedBudgetLines = (results.budgetLines || []).map((line) => {
      if (!line.amount) return { ...line, amount: 0 };
      return {
        ...line,
        amount: this.encryptionService.tryDecryptAmount(line.amount, dek, 0),
      };
    });

    const decryptedTransactions = (results.transactions || []).map((tx) => {
      if (!tx.amount) return { ...tx, amount: 0 };
      return {
        ...tx,
        amount: this.encryptionService.tryDecryptAmount(tx.amount, dek, 0),
      };
    });

    return {
      budget: budgetMappers.toApi({
        ...results.budget,
        ending_balance: results.budget.ending_balance
          ? this.encryptionService.tryDecryptAmount(
              results.budget.ending_balance,
              dek,
              0,
            )
          : null,
      } as unknown as Omit<Tables<'monthly_budget'>, 'ending_balance'> & {
        ending_balance: number | null;
      }),
      transactions: transactionMappers.toApiList(
        decryptedTransactions as unknown as (Omit<
          Tables<'transaction'>,
          'amount'
        > & { amount: number })[],
      ),
      budgetLines: budgetLineMappers.toApiList(
        decryptedBudgetLines as unknown as (Omit<
          Tables<'budget_line'>,
          'amount'
        > & { amount: number })[],
      ),
    };
  }

  private async addRolloverToBudget(
    budgetId: string,
    responseData: BudgetDetailsData,
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ) {
    const rolloverData = await this.calculator.getRollover(
      budgetId,
      payDayOfMonth,
      supabase,
      clientKey,
    );

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
      'Budget details fetched successfully',
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

      await this.calculator.recalculateAndPersist(id, supabase, user.clientKey);

      const apiData = budgetMappers.toApi(budgetDb as Tables<'monthly_budget'>);

      await this.cacheService.invalidateForUser(user.id);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      throw handleServiceError(
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

      await this.cacheService.invalidateForUser(user.id);

      return {
        success: true,
        message: 'Budget deleted successfully',
      };
    } catch (error) {
      throw handleServiceError(
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
      'Budget created from template with atomic transaction',
    );

    return processedResult;
  }

  async recalculateBalances(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer,
  ): Promise<void> {
    await this.calculator.recalculateAndPersist(budgetId, supabase, clientKey);
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
    // Pattern "Log or Throw" - GlobalExceptionFilter handles logging
    const businessException = this.mapPostgreSQLErrorToBusinessException(
      error,
      userId,
      templateId,
    );

    throw businessException;
  }

  private handleConstraintError(
    errorCode: string | undefined,
    userId: string,
    templateId: string,
  ): BusinessException | null {
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

    return null;
  }

  private handleStoredProcedureError(
    errorCode: string | undefined,
    errorMessage: string,
    userId: string,
    templateId: string,
  ): BusinessException | null {
    if (errorCode !== 'P0001') {
      return null;
    }

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

    return null;
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
    const constraintException = this.handleConstraintError(
      errorCode,
      userId,
      templateId,
    );
    if (constraintException) return constraintException;

    // Handle stored procedure errors
    const storedProcException = this.handleStoredProcedureError(
      errorCode,
      errorMessage,
      userId,
      templateId,
    );
    if (storedProcException) return storedProcException;

    // Default error
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
        // Pattern "Log or Throw" - GlobalExceptionFilter handles logging
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

  private async enrichBudgetsWithRemaining(
    budgets: Tables<'monthly_budget'>[],
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<
    (Omit<Tables<'monthly_budget'>, 'ending_balance'> & {
      ending_balance: number | null;
      remaining: number;
    })[]
  > {
    const enrichedBudgets = await Promise.all(
      budgets.map(async (budget) => {
        try {
          const remaining = await this.calculateRemainingForBudget(
            budget,
            supabase,
            payDayOfMonth,
            clientKey,
          );

          const decryptedBalance = await this.#decryptEndingBalance(
            budget,
            clientKey,
          );

          return {
            ...budget,
            ending_balance: decryptedBalance,
            remaining,
          };
        } catch (error) {
          this.logger.warn(
            {
              budgetId: budget.id,
              month: budget.month,
              year: budget.year,
              err: error, // Pino extracts message, stack automatically
              operation: 'enrichBudgetsWithRemaining',
            },
            'Failed to calculate remaining for budget, using fallback',
          );

          const fallbackBalance = await this.#decryptEndingBalance(
            budget,
            clientKey,
          );
          return {
            ...budget,
            ending_balance: fallbackBalance,
            remaining: fallbackBalance,
          };
        }
      }),
    );

    return enrichedBudgets;
  }

  private async calculateRemainingForBudget(
    budget: Tables<'monthly_budget'>,
    supabase: AuthenticatedSupabaseClient,
    payDayOfMonth: number,
    clientKey: Buffer,
  ): Promise<number> {
    try {
      const currentBalance = await this.calculator.calculateEndingBalance(
        budget.id,
        supabase,
        clientKey,
      );
      const rolloverData = await this.calculator.getRollover(
        budget.id,
        payDayOfMonth,
        supabase,
        clientKey,
      );

      return currentBalance + rolloverData.rollover;
    } catch (error) {
      this.logger.warn(
        {
          budgetId: budget.id,
          err: error, // Pino extracts message, stack automatically
          operation: 'calculateRemainingForBudget.fallback',
        },
        'Failed to calculate dynamic remaining, using stored ending_balance',
      );

      const rolloverData = await this.calculator.getRollover(
        budget.id,
        payDayOfMonth,
        supabase,
        clientKey,
      );
      const endingBalanceStored = await this.#decryptEndingBalance(
        budget,
        clientKey,
      );
      return endingBalanceStored + rolloverData.rollover;
    }
  }

  async #decryptEndingBalance(
    budget: Tables<'monthly_budget'>,
    clientKey: Buffer,
  ): Promise<number> {
    if (!budget.ending_balance) return 0;

    const dek = await this.encryptionService.getUserDEK(
      budget.user_id!,
      clientKey,
    );
    return this.encryptionService.tryDecryptAmount(
      budget.ending_balance,
      dek,
      0,
    );
  }
}
