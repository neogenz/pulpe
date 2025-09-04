import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable, HttpException } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { handleServiceError } from '@common/utils/error-handler';
import {
  type TransactionCreate,
  type TransactionDeleteResponse,
  type TransactionListResponse,
  type TransactionResponse,
  type TransactionUpdate,
} from '@pulpe/shared';
import * as transactionMappers from './transaction.mappers';
import { TRANSACTION_CONSTANTS } from './entities';
import type { Database } from '../../types/database.types';
import { BudgetService } from '../budget/budget.service';

@Injectable()
export class TransactionService {
  constructor(
    @InjectPinoLogger(TransactionService.name)
    private readonly logger: PinoLogger,
    private readonly budgetService: BudgetService,
  ) {}

  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: transactionsDb, error } = await supabase
        .from('transaction')
        .select('*')
        .order('transaction_date', { ascending: false });

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

      const apiData = transactionMappers.toApiList(transactionsDb || []);

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

  private prepareTransactionData(createTransactionDto: TransactionCreate) {
    // Manual conversion without Zod validation (already validated in service)
    return {
      budget_id: createTransactionDto.budgetId,
      amount: createTransactionDto.amount,
      name: createTransactionDto.name,
      kind: createTransactionDto.kind as Database['public']['Enums']['transaction_kind'],
      transaction_date:
        createTransactionDto.transactionDate || new Date().toISOString(),
      is_out_of_budget: createTransactionDto.isOutOfBudget || false,
      category: createTransactionDto.category ?? null,
    };
  }

  private async insertTransaction(
    transactionData: ReturnType<typeof this.prepareTransactionData>,
    supabase: AuthenticatedSupabaseClient,
    userId?: string,
  ): Promise<Database['public']['Tables']['transaction']['Row']> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      // Pattern "Enrichir et Relancer" - log technique + throw métier
      this.logger.error(
        {
          err: error,
          operation: 'insertTransaction',
          userId,
          entityType: 'transaction',
          supabaseError: error,
        },
        'Supabase insert transaction failed',
      );

      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        {
          operation: 'insertTransaction',
          userId,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return transactionDb;
  }

  async create(
    createTransactionDto: TransactionCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      this.validateCreateTransactionDto(createTransactionDto);

      const transactionData = this.prepareTransactionData(createTransactionDto);
      const transactionDb = await this.insertTransaction(
        transactionData,
        supabase,
        user.id,
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
      const apiData = transactionMappers.toApi(transactionDb);

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
      ...(updateTransactionDto.isOutOfBudget !== undefined && {
        is_out_of_budget: updateTransactionDto.isOutOfBudget,
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
      const transactionDb = await this.updateTransactionInDb(
        id,
        updateData,
        supabase,
        user.id,
      );

      await this.budgetService.recalculateBalances(
        transactionDb.budget_id,
        supabase,
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
    startTime: number,
  ): never {
    // Use the error handler for consistency (it will re-throw known exceptions)
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }

    // Log unexpected errors before wrapping
    this.logger.error(
      {
        operation: 'deleteTransaction',
        userId,
        entityId,
        duration: Date.now() - startTime,
        err: error,
      },
      'Unexpected error during transaction deletion',
    );

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
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: transactionsDb, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('budget_id', budgetId)
        .order('transaction_date', { ascending: false });

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

      const apiData = transactionMappers.toApiList(transactionsDb || []);

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
}
