import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
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

@Injectable()
export class TransactionService {
  constructor(
    @InjectPinoLogger(TransactionService.name)
    private readonly logger: PinoLogger,
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
        this.logger.error({ err: error }, 'Failed to fetch transactions');
        throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED);
      }

      const apiData = transactionMappers.toApiList(transactionsDb || []);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED);
    }
  }

  private validateCreateTransactionDto(
    createTransactionDto: TransactionCreate,
  ): void {
    // Basic business validation (Supabase handles DB constraints)
    if (!createTransactionDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
    }

    if (!createTransactionDto.amount || createTransactionDto.amount <= 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
      );
    }

    if (createTransactionDto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
      throw new BadRequestException(
        `Amount cannot exceed ${TRANSACTION_CONSTANTS.MAX_AMOUNT}`,
      );
    }

    if (
      !createTransactionDto.name ||
      createTransactionDto.name.trim().length === 0
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
    }

    if (
      createTransactionDto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Name cannot exceed ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} characters`,
      );
    }
  }

  private prepareTransactionData(createTransactionDto: TransactionCreate) {
    if (!createTransactionDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
    }

    return {
      budget_id: createTransactionDto.budgetId,
      amount: createTransactionDto.amount,
      name: createTransactionDto.name,
      transaction_date:
        createTransactionDto.transactionDate || new Date().toISOString(),
      is_out_of_budget: createTransactionDto.isOutOfBudget || false,
      category: createTransactionDto.category || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertTransaction(
    transactionData: ReturnType<typeof this.prepareTransactionData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Database['public']['Tables']['transaction']['Row']> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      this.logger.error({ err: error }, 'Failed to create transaction');
      if (error.message) {
        throw new BadRequestException(error.message);
      }
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED);
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
      );

      const apiData = transactionMappers.toApi(transactionDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED);
    }
  }

  async findOne(
    id: string,
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const { data: transactionDb, error } = await supabase
        .from('transaction')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !transactionDb) {
        throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND);
      }

      const apiData = transactionMappers.toApi(transactionDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to fetch single transaction');
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED);
    }
  }

  private validateUpdateTransactionDto(
    updateTransactionDto: TransactionUpdate,
  ): void {
    // Basic business validation for optional fields
    if (updateTransactionDto.amount !== undefined) {
      if (updateTransactionDto.amount <= 0) {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_VALIDATION_FAILED,
        );
      }
      if (updateTransactionDto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
        throw new BadRequestException(
          `Amount cannot exceed ${TRANSACTION_CONSTANTS.MAX_AMOUNT}`,
        );
      }
    }

    if (updateTransactionDto.name !== undefined) {
      if (updateTransactionDto.name.trim().length === 0) {
        throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
      }
      if (
        updateTransactionDto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH
      ) {
        throw new BadRequestException(
          `Name cannot exceed ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} characters`,
        );
      }
    }
  }

  private prepareTransactionUpdateData(
    updateTransactionDto: TransactionUpdate,
  ): Record<string, unknown> {
    return {
      ...(updateTransactionDto.amount && {
        amount: updateTransactionDto.amount,
      }),
      ...(updateTransactionDto.name && { name: updateTransactionDto.name }),
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
  ): Promise<Database['public']['Tables']['transaction']['Row']> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !transactionDb) {
      this.logger.error({ err: error }, 'Failed to update transaction');
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND);
    }

    return transactionDb;
  }

  async update(
    id: string,
    updateTransactionDto: TransactionUpdate,
    _user: AuthenticatedUser,
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
      );

      const apiData = transactionMappers.toApi(transactionDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to update transaction');
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_UPDATE_FAILED);
    }
  }

  async remove(
    id: string,
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionDeleteResponse> {
    try {
      const { error } = await supabase
        .from('transaction')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error({ err: error }, 'Failed to delete transaction');
        throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND);
      }

      return {
        success: true,
        message: 'Transaction deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_DELETE_FAILED);
    }
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
        this.logger.error(
          { err: error },
          'Failed to fetch transactions by budget',
        );
        throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED);
      }

      const apiData = transactionMappers.toApiList(transactionsDb || []);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to list transactions by budget',
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED);
    }
  }
}
