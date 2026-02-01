import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable, HttpException } from '@nestjs/common';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { handleServiceError } from '@common/utils/error-handler';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import {
  type TransactionCreate,
  type TransactionDeleteResponse,
  type TransactionKind,
  type TransactionListResponse,
  type TransactionResponse,
  type TransactionSearchResponse,
  type TransactionSearchResult,
  type TransactionUpdate,
} from 'pulpe-shared';
import * as transactionMappers from './transaction.mappers';
import { TRANSACTION_CONSTANTS } from './entities';
import type { Database, TablesInsert } from '../../types/database.types';
import { BudgetService } from '../budget/budget.service';
import { EncryptionService } from '@modules/encryption/encryption.service';

@Injectable()
export class TransactionService {
  constructor(
    @InjectInfoLogger(TransactionService.name)
    private readonly logger: InfoLogger,
    private readonly budgetService: BudgetService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: transactionsDb, error } = await supabase
        .from('transaction')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          undefined,
          {
            operation: 'listTransactions',
            entityType: 'transaction',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      const decryptedTransactions = await this.decryptTransactions(
        transactionsDb || [],
        user.id,
        user.clientKey,
      );
      const apiData = transactionMappers.toApiList(decryptedTransactions);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactions',
          entityType: 'transaction',
        },
      );
    }
  }

  private validateCreateTransactionDto(
    createTransactionDto: TransactionCreate,
  ): void {
    // Basic business validation (Supabase handles DB constraints)
    if (!createTransactionDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['budgetId'],
      });
    }

    if (!createTransactionDto.amount || createTransactionDto.amount <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: 'Amount must be greater than 0' },
      );
    }

    if (createTransactionDto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        { reason: `Amount cannot exceed ${TRANSACTION_CONSTANTS.MAX_AMOUNT}` },
      );
    }

    if (
      !createTransactionDto.name ||
      createTransactionDto.name.trim().length === 0
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['name'],
      });
    }

    if (
      createTransactionDto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Name cannot exceed ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} characters`,
        },
      );
    }
  }

  /**
   * Validate that the budget line allocation is valid:
   * - Budget line must exist
   * - Budget line must belong to the same budget as the transaction
   * - Transaction kind must match budget line kind
   */
  private async validateBudgetLineAllocation(
    budgetLineId: string,
    budgetId: string,
    transactionKind: TransactionKind,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data: budgetLine, error } = await supabase
      .from('budget_line')
      .select('budget_id, kind')
      .eq('id', budgetLineId)
      .single();

    if (error || !budgetLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'validateBudgetLineAllocation',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }

    // Validate budget match
    if (budgetLine.budget_id !== budgetId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: 'Transaction budget must match budget line budget',
        },
      );
    }

    // Validate kind match
    if (budgetLine.kind !== transactionKind) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        {
          reason: `Transaction kind must match budget line kind (expected: ${budgetLine.kind}, got: ${transactionKind})`,
        },
      );
    }
  }

  private prepareTransactionData(createTransactionDto: TransactionCreate) {
    // Manual conversion without Zod validation (already validated in service)
    return {
      budget_id: createTransactionDto.budgetId,
      budget_line_id: createTransactionDto.budgetLineId ?? null,
      amount: createTransactionDto.amount,
      name: createTransactionDto.name,
      kind: createTransactionDto.kind as Database['public']['Enums']['transaction_kind'],
      transaction_date:
        createTransactionDto.transactionDate || new Date().toISOString(),
      category: createTransactionDto.category ?? null,
      checked_at: createTransactionDto.checkedAt ?? null,
    };
  }

  private async insertTransaction(
    transactionData: TablesInsert<'transaction'>,
    supabase: AuthenticatedSupabaseClient,
    userId?: string,
  ): Promise<Database['public']['Tables']['transaction']['Row']> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      // Pattern "Log or Throw" - GlobalExceptionFilter handles logging
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        {
          operation: 'insertTransaction',
          userId,
          entityType: 'transaction',
          supabaseErrorCode: error.code,
        },
        { cause: error },
      );
    }

    return transactionDb;
  }

  private decryptTransactionWithDEK(
    transaction: Database['public']['Tables']['transaction']['Row'],
    dek: Buffer,
  ): Database['public']['Tables']['transaction']['Row'] {
    const amountEncrypted = (transaction as Record<string, unknown>)
      .amount_encrypted as string | undefined;

    if (amountEncrypted) {
      const decryptedAmount = this.encryptionService.tryDecryptAmount(
        amountEncrypted,
        dek,
        transaction.amount,
      );
      return {
        ...transaction,
        amount: decryptedAmount,
      };
    }

    return transaction;
  }

  private async decryptTransaction(
    transaction: Database['public']['Tables']['transaction']['Row'],
    userId: string,
    clientKey: Buffer,
  ): Promise<Database['public']['Tables']['transaction']['Row']> {
    const dek = await this.encryptionService.getUserDEK(userId, clientKey);
    return this.decryptTransactionWithDEK(transaction, dek);
  }

  private async decryptTransactions(
    transactions: Database['public']['Tables']['transaction']['Row'][],
    userId: string,
    clientKey: Buffer,
  ): Promise<Database['public']['Tables']['transaction']['Row'][]> {
    const dek = await this.encryptionService.getUserDEK(userId, clientKey);
    return transactions.map((transaction) =>
      this.decryptTransactionWithDEK(transaction, dek),
    );
  }

  async create(
    createTransactionDto: TransactionCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      this.validateCreateTransactionDto(createTransactionDto);

      // Validate budget line allocation if provided
      if (createTransactionDto.budgetLineId) {
        await this.validateBudgetLineAllocation(
          createTransactionDto.budgetLineId,
          createTransactionDto.budgetId,
          createTransactionDto.kind,
          supabase,
        );
      }

      const transactionData = this.prepareTransactionData(createTransactionDto);

      // Get user DEK and encrypt amount
      const dek = await this.encryptionService.ensureUserDEK(
        user.id,
        user.clientKey,
      );
      const encryptedAmount = this.encryptionService.encryptAmount(
        createTransactionDto.amount,
        dek,
      );
      const dataWithEncryption = {
        ...transactionData,
        amount: 0,
        amount_encrypted: encryptedAmount,
      };

      const transactionDb = await this.insertTransaction(
        dataWithEncryption,
        supabase,
        user.id,
      );

      await this.budgetService.recalculateBalances(
        transactionDb.budget_id,
        supabase,
        user.clientKey,
      );

      const apiData = transactionMappers.toApi(transactionDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        {
          operation: 'createTransaction',
          userId: user.id,
          entityType: 'transaction',
        },
      );
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const transactionDb = await this.fetchTransactionById(id, user, supabase);
      const decryptedTransaction = await this.decryptTransaction(
        transactionDb,
        user.id,
        user.clientKey,
      );
      const apiData = transactionMappers.toApi(decryptedTransaction);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      this.handleTransactionFindOneError(error, id, user);
    }
  }

  private async fetchTransactionById(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !transactionDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'getTransaction',
          userId: user.id,
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }

    return transactionDb;
  }

  private handleTransactionFindOneError(
    error: unknown,
    id: string,
    user: AuthenticatedUser,
  ): never {
    handleServiceError(
      error,
      ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
      undefined,
      {
        operation: 'getTransaction',
        userId: user.id,
        entityId: id,
        entityType: 'transaction',
      },
    );
  }

  private validateUpdateTransactionDto(
    updateTransactionDto: TransactionUpdate,
  ): void {
    // Basic business validation for optional fields
    if (updateTransactionDto.amount !== undefined) {
      if (updateTransactionDto.amount <= 0) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
          { reason: 'Amount must be greater than 0' },
        );
      }
      if (updateTransactionDto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
          {
            reason: `Amount cannot exceed ${TRANSACTION_CONSTANTS.MAX_AMOUNT}`,
          },
        );
      }
    }

    if (updateTransactionDto.name !== undefined) {
      if (updateTransactionDto.name.trim().length === 0) {
        throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
          fields: ['name'],
        });
      }
      if (
        updateTransactionDto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH
      ) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
          {
            reason: `Name cannot exceed ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} characters`,
          },
        );
      }
    }
  }

  private prepareTransactionUpdateData(
    updateTransactionDto: TransactionUpdate,
  ): Record<string, unknown> {
    return {
      ...(updateTransactionDto.amount !== undefined && {
        amount: updateTransactionDto.amount,
      }),
      ...(updateTransactionDto.name && { name: updateTransactionDto.name }),
      ...(updateTransactionDto.kind !== undefined && {
        kind: updateTransactionDto.kind as Database['public']['Enums']['transaction_kind'],
      }),
      ...(updateTransactionDto.transactionDate !== undefined && {
        transaction_date: updateTransactionDto.transactionDate,
      }),
      ...(updateTransactionDto.category !== undefined && {
        category: updateTransactionDto.category,
      }),
      updated_at: new Date().toISOString(),
    };
  }

  private async updateTransactionInDb(
    id: string,
    updateData: Record<string, unknown>,
    supabase: AuthenticatedSupabaseClient,
    userId?: string,
  ): Promise<Database['public']['Tables']['transaction']['Row']> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !transactionDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'updateTransactionInDb',
          userId,
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return transactionDb;
  }

  async update(
    id: string,
    updateTransactionDto: TransactionUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      this.validateUpdateTransactionDto(updateTransactionDto);

      const updateData =
        this.prepareTransactionUpdateData(updateTransactionDto);

      // If amount is being updated, encrypt it
      if (updateTransactionDto.amount !== undefined) {
        const dek = await this.encryptionService.ensureUserDEK(
          user.id,
          user.clientKey,
        );
        const encryptedAmount = this.encryptionService.encryptAmount(
          updateTransactionDto.amount,
          dek,
        );
        updateData.amount = 0;
        updateData.amount_encrypted = encryptedAmount;
      }

      const transactionDb = await this.updateTransactionInDb(
        id,
        updateData,
        supabase,
        user.id,
      );

      await this.budgetService.recalculateBalances(
        transactionDb.budget_id,
        supabase,
        user.clientKey,
      );

      const apiData = transactionMappers.toApi(transactionDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
        { id },
        {
          operation: 'updateTransaction',
          userId: user.id,
          entityId: id,
          entityType: 'transaction',
        },
      );
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionDeleteResponse> {
    const startTime = Date.now();

    try {
      const { data: transaction } = await supabase
        .from('transaction')
        .select('budget_id')
        .eq('id', id)
        .single();

      await this.performTransactionDeletion(id, supabase);

      if (transaction?.budget_id) {
        await this.budgetService.recalculateBalances(
          transaction.budget_id,
          supabase,
          user.clientKey,
        );
      }

      this.logTransactionDeletionSuccess(user.id, id, startTime);

      return {
        success: true,
        message: 'Transaction deleted successfully',
      };
    } catch (error) {
      return this.handleTransactionDeletionError(error, user.id, id, startTime);
    }
  }

  private async performTransactionDeletion(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase.from('transaction').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'deleteTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  private logTransactionDeletionSuccess(
    userId: string,
    entityId: string,
    startTime: number,
  ): void {
    this.logger.info(
      {
        operation: 'deleteTransaction',
        userId,
        entityId,
        entityType: 'transaction',
        duration: Date.now() - startTime,
      },
      'Transaction deleted successfully',
    );
  }

  private handleTransactionDeletionError(
    error: unknown,
    userId: string,
    entityId: string,
    _startTime: number,
  ): never {
    // Use the error handler for consistency (it will re-throw known exceptions)
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }

    // Pattern "Log or Throw" - GlobalExceptionFilter handles logging
    // Use error handler for the wrapping logic
    handleServiceError(
      error,
      ERROR_DEFINITIONS.TRANSACTION_DELETE_FAILED,
      { id: entityId },
      {
        operation: 'deleteTransaction',
        userId,
        entityId,
        entityType: 'transaction',
      },
    );
  }

  async findByBudgetId(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: transactionsDb, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('budget_id', budgetId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          undefined,
          {
            operation: 'listTransactionsByBudget',
            entityId: budgetId,
            entityType: 'budget',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      const decryptedTransactions = await this.decryptTransactions(
        transactionsDb || [],
        user.id,
        user.clientKey,
      );
      const apiData = transactionMappers.toApiList(decryptedTransactions);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudget',
          entityId: budgetId,
          entityType: 'budget',
        },
      );
    }
  }

  /**
   * Validates that a budget line exists and is accessible to the current user.
   * RLS policies ensure only budget lines belonging to the user are returned.
   */
  private async validateBudgetLineExists(
    budgetLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data: budgetLine, error } = await supabase
      .from('budget_line')
      .select('id')
      .eq('id', budgetLineId)
      .single();

    if (error || !budgetLine) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'validateBudgetLineExists',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }
  }

  /**
   * Find all transactions allocated to a specific budget line
   * Returns transactions sorted by transaction_date descending (most recent first)
   */
  async findByBudgetLineId(
    budgetLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      await this.validateBudgetLineExists(budgetLineId, supabase);

      const { data: transactionsDb, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('budget_line_id', budgetLineId)
        .order('transaction_date', { ascending: false });

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          undefined,
          {
            operation: 'listTransactionsByBudgetLine',
            entityId: budgetLineId,
            entityType: 'budget_line',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      const decryptedTransactions = await this.decryptTransactions(
        transactionsDb || [],
        user.id,
        user.clientKey,
      );
      const apiData = transactionMappers.toApiList(decryptedTransactions);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudgetLine',
          entityId: budgetLineId,
          entityType: 'budget_line',
        },
      );
    }
  }

  /**
   * Toggle the checked state of a transaction
   * If checked_at is null, sets it to current timestamp
   * If checked_at has a value, sets it to null
   * Does NOT trigger budget recalculation (lightweight operation)
   */
  async toggleCheck(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    const startTime = Date.now();

    try {
      const transactionDb = await this.fetchTransactionById(id, user, supabase);

      const newCheckedAt =
        transactionDb.checked_at === null ? new Date().toISOString() : null;

      const updatedTransaction = await this.updateTransactionInDb(
        id,
        { checked_at: newCheckedAt, updated_at: new Date().toISOString() },
        supabase,
        user.id,
      );

      const apiData = transactionMappers.toApi(updatedTransaction);

      this.logger.info(
        {
          operation: 'toggleTransactionCheck',
          userId: user.id,
          entityId: id,
          entityType: 'transaction',
          newCheckedAt,
          duration: Date.now() - startTime,
        },
        'Transaction check state toggled successfully',
      );

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED,
        { id },
        {
          operation: 'toggleTransactionCheck',
          userId: user.id,
          entityId: id,
          entityType: 'transaction',
        },
      );
    }
  }

  /**
   * Search globally across all user's transactions and budget lines
   * Searches in name and category fields using ILIKE
   * Returns enriched results with budget context for display
   */
  async search(
    query: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
    years?: number[],
  ): Promise<TransactionSearchResponse> {
    try {
      const searchPattern = this.#buildSearchPattern(query);

      const budgetIds = years?.length
        ? await this.#fetchBudgetIdsByYears(years, supabase)
        : undefined;

      if (years?.length && budgetIds?.length === 0) {
        return { success: true, data: [] };
      }

      const [transactionsDb, budgetLinesDb] = await Promise.all([
        this.#fetchTransactionsByPattern(searchPattern, budgetIds, supabase),
        this.#fetchBudgetLinesByPattern(searchPattern, budgetIds, supabase),
      ]);

      const dek = await this.encryptionService.getUserDEK(
        user.id,
        user.clientKey,
      );

      const decryptedTransactions = transactionsDb.map((t) => {
        if (!t.amount_encrypted) return t;
        return {
          ...t,
          amount: this.encryptionService.tryDecryptAmount(
            t.amount_encrypted,
            dek,
            t.amount,
          ),
        };
      });

      const decryptedBudgetLines = budgetLinesDb.map((bl) => {
        if (!bl.amount_encrypted) return bl;
        return {
          ...bl,
          amount: this.encryptionService.tryDecryptAmount(
            bl.amount_encrypted,
            dek,
            bl.amount,
          ),
        };
      });

      const allResults = [
        ...decryptedTransactions.map((t) =>
          this.#mapTransactionToSearchResult(t),
        ),
        ...decryptedBudgetLines.map((bl) =>
          this.#mapBudgetLineToSearchResult(bl),
        ),
      ].sort((a, b) => b.year - a.year || b.month - a.month);

      return {
        success: true as const,
        data: allResults.slice(0, 50),
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'search',
          entityType: 'transaction',
        },
      );
    }
  }

  #buildSearchPattern(query: string): string {
    const escapedQuery = query.replace(/[*.()[\]\\]/g, '\\$&');
    return `*${escapedQuery}*`;
  }

  async #fetchBudgetIdsByYears(
    years: number[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    const { data: budgets, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .in('year', years);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetIdsByYears',
          entityType: 'monthly_budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return budgets?.map((b) => b.id) ?? [];
  }

  async #fetchTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | undefined,
    supabase: AuthenticatedSupabaseClient,
  ) {
    let query = supabase
      .from('transaction')
      .select(
        `
        id,
        name,
        amount,
        amount_encrypted,
        kind,
        transaction_date,
        category,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .or(`name.ilike.${searchPattern},category.ilike.${searchPattern}`);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchTransactionsByPattern',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async #fetchBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | undefined,
    supabase: AuthenticatedSupabaseClient,
  ) {
    let query = supabase
      .from('budget_line')
      .select(
        `
        id,
        name,
        amount,
        amount_encrypted,
        kind,
        recurrence,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .ilike('name', searchPattern);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetLinesByPattern',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  #mapTransactionToSearchResult(t: {
    id: string;
    name: string;
    amount: number;
    kind: string;
    transaction_date: string;
    category: string | null;
    budget_id: string;
    budget: unknown;
  }): TransactionSearchResult {
    const budget = t.budget as {
      description: string;
      month: number;
      year: number;
    } | null;

    return {
      id: t.id,
      itemType: 'transaction' as const,
      name: t.name,
      amount: t.amount,
      kind: t.kind as TransactionKind,
      recurrence: null,
      transactionDate: t.transaction_date,
      category: t.category,
      budgetId: t.budget_id,
      budgetName: budget?.description ?? '',
      year: budget?.year ?? new Date().getFullYear(),
      month: budget?.month ?? 1,
      monthLabel: this.#getMonthLabel(budget?.month ?? 1),
    };
  }

  #mapBudgetLineToSearchResult(bl: {
    id: string;
    name: string;
    amount: number;
    kind: string;
    recurrence: 'fixed' | 'one_off';
    budget_id: string;
    budget: unknown;
  }): TransactionSearchResult {
    const budget = bl.budget as {
      description: string;
      month: number;
      year: number;
    } | null;

    return {
      id: bl.id,
      itemType: 'budget_line' as const,
      name: bl.name,
      amount: bl.amount,
      kind: bl.kind as TransactionKind,
      recurrence: bl.recurrence,
      transactionDate: null,
      category: null,
      budgetId: bl.budget_id,
      budgetName: budget?.description ?? '',
      year: budget?.year ?? new Date().getFullYear(),
      month: budget?.month ?? 1,
      monthLabel: this.#getMonthLabel(budget?.month ?? 1),
    };
  }

  #getMonthLabel(month: number): string {
    const months = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    return months[month - 1] || '';
  }
}
