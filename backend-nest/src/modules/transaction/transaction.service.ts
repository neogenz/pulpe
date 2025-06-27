import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  type TransactionCreate,
  type TransactionUpdate,
  type TransactionResponse,
  type TransactionListResponse,
  type TransactionDeleteResponse,
} from '@pulpe/shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { TransactionMapper } from './transaction.mapper';
import type { TransactionDbEntity } from './schemas/transaction.db.schema';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly transactionMapper: TransactionMapper) {}
  async findByBudget(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: transactionsDb, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('budget_id', budgetId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error('Erreur récupération transactions:', error);
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des transactions',
        );
      }

      const transactions = this.transactionMapper.toApiList(
        transactionsDb || [],
      );

      return {
        success: true,
        data: transactions,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Erreur liste transactions:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async create(
    createTransactionDto: TransactionCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const transactionData = this.transactionMapper.toDbCreate(
        createTransactionDto,
        user.id,
      );

      const { data: transactionDb, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur création transaction:', error);
        throw new BadRequestException(
          'Erreur lors de la création de la transaction',
        );
      }

      const transaction = this.transactionMapper.toApi(
        transactionDb as TransactionDbEntity,
      );

      return {
        success: true,
        data: transaction,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur création transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const { data: transactionDb, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !transactionDb) {
        throw new NotFoundException(
          'Transaction introuvable ou accès non autorisé',
        );
      }

      const transaction = this.transactionMapper.toApi(
        transactionDb as TransactionDbEntity,
      );

      return {
        success: true,
        data: transaction,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur récupération transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async update(
    id: string,
    updateTransactionDto: TransactionUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const updateData = {
        ...this.transactionMapper.toDbUpdate(updateTransactionDto),
        updated_at: new Date().toISOString(),
      };

      const { data: transactionDb, error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !transactionDb) {
        this.logger.error('Erreur modification transaction:', error);
        throw new NotFoundException(
          'Transaction introuvable ou modification non autorisée',
        );
      }

      const transaction = this.transactionMapper.toApi(
        transactionDb as TransactionDbEntity,
      );

      return {
        success: true,
        data: transaction,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur modification transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionDeleteResponse> {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error('Erreur suppression transaction:', error);
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
      this.logger.error('Erreur suppression transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }
}
