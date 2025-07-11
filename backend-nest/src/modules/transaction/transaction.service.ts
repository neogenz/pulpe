import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  type TransactionCreate,
  type TransactionDeleteResponse,
  type TransactionListResponse,
  type TransactionResponse,
  type TransactionUpdate,
} from '@pulpe/shared';
import { type TransactionRow, TRANSACTION_CONSTANTS } from './entities';
import { TransactionMapper } from './transaction.mapper';
import type { Database } from '../../types/database.types';

@Injectable()
export class TransactionService {
  constructor(
    @InjectPinoLogger(TransactionService.name)
    private readonly logger: PinoLogger,
    private readonly transactionMapper: TransactionMapper,
  ) {}

  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: transactionsDb, error } = await supabase
        .from('transaction')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error({ err: error }, 'Failed to fetch transactions');
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des transactions',
        );
      }

      const transactions = this.validateAndEnrichTransactions(
        transactionsDb || [],
      );
      const apiData = this.transactionMapper.toApiList(transactions);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to list transactions');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateCreateTransactionDto(
    createTransactionDto: TransactionCreate,
  ): void {
    // Validation métier basique (Supabase gère les contraintes de DB)
    if (!createTransactionDto.budgetId) {
      throw new BadRequestException('Budget ID est requis');
    }

    if (!createTransactionDto.amount || createTransactionDto.amount <= 0) {
      throw new BadRequestException('Montant doit être positif');
    }

    if (createTransactionDto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
      throw new BadRequestException(
        `Montant ne peut pas dépasser ${TRANSACTION_CONSTANTS.MAX_AMOUNT}`,
      );
    }

    if (
      !createTransactionDto.name ||
      createTransactionDto.name.trim().length === 0
    ) {
      throw new BadRequestException('Nom est requis');
    }

    if (
      createTransactionDto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Nom ne peut pas dépasser ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} caractères`,
      );
    }

    // Validation métier : income ne peut pas avoir expense_type
    if (
      createTransactionDto.type === 'income' &&
      createTransactionDto.expenseType
    ) {
      throw new BadRequestException(
        'Les revenus ne peuvent pas avoir de type de dépense',
      );
    }
  }

  private prepareTransactionData(
    createTransactionDto: TransactionCreate,
    userId: string,
  ) {
    if (!createTransactionDto.budgetId) {
      throw new BadRequestException('Budget ID est requis');
    }

    return {
      budget_id: createTransactionDto.budgetId,
      amount: createTransactionDto.amount,
      type: createTransactionDto.type,
      expense_type: createTransactionDto.expenseType,
      name: createTransactionDto.name,
      description: createTransactionDto.description || null,
      is_recurring: createTransactionDto.isRecurring || false,
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertTransaction(
    transactionData: ReturnType<typeof this.prepareTransactionData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      this.logger.error({ err: error }, 'Failed to create transaction');
      throw new BadRequestException(
        'Erreur lors de la création de la transaction',
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

      const transactionData = this.prepareTransactionData(
        createTransactionDto,
        user.id,
      );
      const transactionDb = await this.insertTransaction(
        transactionData,
        supabase,
      );

      const transaction = this.validateAndEnrichTransaction(transactionDb);
      if (!transaction) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation de la transaction créée',
        );
      }

      const apiData = this.transactionMapper.toApi(transaction);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to create transaction');
      throw new InternalServerErrorException('Erreur interne du serveur');
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
        throw new NotFoundException(
          'Transaction introuvable ou accès non autorisé',
        );
      }

      const transaction = this.validateAndEnrichTransaction(transactionDb);
      if (!transaction) {
        throw new NotFoundException(
          'Transaction introuvable ou données invalides',
        );
      }

      const apiData = this.transactionMapper.toApi(transaction);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to fetch single transaction');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateUpdateTransactionDto(
    updateTransactionDto: TransactionUpdate,
  ): void {
    // Validation métier basique pour les champs optionnels
    if (updateTransactionDto.amount !== undefined) {
      if (updateTransactionDto.amount <= 0) {
        throw new BadRequestException('Montant doit être positif');
      }
      if (updateTransactionDto.amount > TRANSACTION_CONSTANTS.MAX_AMOUNT) {
        throw new BadRequestException(
          `Montant ne peut pas dépasser ${TRANSACTION_CONSTANTS.MAX_AMOUNT}`,
        );
      }
    }

    if (updateTransactionDto.name !== undefined) {
      if (updateTransactionDto.name.trim().length === 0) {
        throw new BadRequestException('Nom ne peut pas être vide');
      }
      if (
        updateTransactionDto.name.length > TRANSACTION_CONSTANTS.NAME_MAX_LENGTH
      ) {
        throw new BadRequestException(
          `Nom ne peut pas dépasser ${TRANSACTION_CONSTANTS.NAME_MAX_LENGTH} caractères`,
        );
      }
    }

    // Validation métier : income ne peut pas avoir expense_type
    if (
      updateTransactionDto.type === 'income' &&
      updateTransactionDto.expenseType
    ) {
      throw new BadRequestException(
        'Les revenus ne peuvent pas avoir de type de dépense',
      );
    }
  }

  private prepareTransactionUpdateData(
    updateTransactionDto: TransactionUpdate,
  ): Record<string, unknown> {
    return {
      ...(updateTransactionDto.amount && {
        amount: updateTransactionDto.amount,
      }),
      ...(updateTransactionDto.type && { type: updateTransactionDto.type }),
      ...(updateTransactionDto.expenseType && {
        expense_type: updateTransactionDto.expenseType,
      }),
      ...(updateTransactionDto.name && { name: updateTransactionDto.name }),
      ...(updateTransactionDto.description !== undefined && {
        description: updateTransactionDto.description,
      }),
      ...(updateTransactionDto.isRecurring !== undefined && {
        is_recurring: updateTransactionDto.isRecurring,
      }),
      updated_at: new Date().toISOString(),
    };
  }

  private async updateTransactionInDb(
    id: string,
    updateData: Record<string, unknown>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data: transactionDb, error } = await supabase
      .from('transaction')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !transactionDb) {
      this.logger.error({ err: error }, 'Failed to update transaction');
      throw new NotFoundException(
        'Transaction introuvable ou modification non autorisée',
      );
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

      const transaction = this.validateAndEnrichTransaction(transactionDb);
      if (!transaction) {
        throw new InternalServerErrorException(
          'Erreur lors de la validation de la transaction modifiée',
        );
      }

      const apiData = this.transactionMapper.toApi(transaction);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to update transaction');
      throw new InternalServerErrorException('Erreur interne du serveur');
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
        throw new NotFoundException(
          'Transaction introuvable ou suppression non autorisée',
        );
      }

      return {
        success: true,
        message: 'Transaction supprimée avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to delete transaction');
      throw new InternalServerErrorException('Erreur interne du serveur');
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
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          { err: error },
          'Failed to fetch transactions by budget',
        );
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des transactions',
        );
      }

      const transactions = this.validateAndEnrichTransactions(
        transactionsDb || [],
      );
      const apiData = this.transactionMapper.toApiList(transactions);

      return {
        success: true as const,
        data: apiData,
      } as TransactionListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        { err: error },
        'Failed to list transactions by budget',
      );
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateAndEnrichTransactions(
    rawTransactions: unknown[],
  ): EnrichedTransaction[] {
    return rawTransactions
      .map(this.validateAndEnrichTransaction.bind(this))
      .filter(
        (transaction): transaction is EnrichedTransaction =>
          transaction !== null,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }

  private validateAndEnrichTransaction(
    rawTransaction: unknown,
  ): EnrichedTransaction | null {
    // Validation avec type guard
    if (!this.isValidTransactionRow(rawTransaction)) {
      this.logger.warn({ data: rawTransaction }, 'Invalid transaction data');
      return null;
    }

    return {
      ...rawTransaction,
      displayAmount: this.formatAmount(rawTransaction),
      isRecurring: rawTransaction.is_recurring,
      categoryDisplay: this.getCategoryDisplay(rawTransaction),
    };
  }

  private isValidTransactionRow(data: unknown): data is TransactionRow {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const transaction = data as Record<string, unknown>;

    return (
      typeof transaction.id === 'string' &&
      typeof transaction.budget_id === 'string' &&
      typeof transaction.amount === 'number' &&
      typeof transaction.name === 'string' &&
      typeof transaction.type === 'string' &&
      typeof transaction.expense_type === 'string' &&
      typeof transaction.created_at === 'string' &&
      typeof transaction.updated_at === 'string' &&
      typeof transaction.is_recurring === 'boolean' &&
      (transaction.user_id === null ||
        typeof transaction.user_id === 'string') &&
      (transaction.description === null ||
        typeof transaction.description === 'string')
    );
  }

  private formatAmount(transaction: TransactionRow): string {
    const sign = transaction.type === 'expense' ? '-' : '+';
    return `${sign}${TRANSACTION_CONSTANTS.CURRENCY} ${transaction.amount.toFixed(2)}`;
  }

  private getCategoryDisplay(transaction: TransactionRow): string {
    const typeLabels = {
      expense: 'Dépense',
      income: 'Revenu',
      saving: 'Épargne',
      exceptional_income: 'Revenu exceptionnel',
    } as const;

    const recurrenceLabels = {
      fixed: 'Fixe',
      variable: 'Variable',
      one_off: 'Ponctuel',
    } as const;

    const baseLabel = typeLabels[transaction.type];
    if (transaction.type === 'expense') {
      return `${baseLabel} ${recurrenceLabels[transaction.expense_type]}`;
    }

    return baseLabel;
  }
}

type EnrichedTransaction =
  Database['public']['Tables']['transaction']['Row'] & {
    displayAmount: string;
    isRecurring: boolean;
    categoryDisplay: string;
  };
