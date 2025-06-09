import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import {
  type TransactionCreateRequest,
  type TransactionUpdateRequest,
  type TransactionResponse,
  type TransactionInsert,
} from '@pulpe/shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';

@Injectable()
export class TransactionService {
  async findByBudget(
    budgetId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('budget_id', budgetId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur récupération transactions:', error);
        throw new InternalServerErrorException('Erreur lors de la récupération des transactions');
      }

      return {
        success: true as const,
        transactions: transactions || [],
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Erreur liste transactions:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async create(
    createTransactionDto: TransactionCreateRequest,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const transactionData: TransactionInsert = {
        ...createTransactionDto,
        user_id: user.id,
      };

      const { data: transaction, error } = await supabase
        .from('transactions')
        .insert(transactionData)
        .select()
        .single();

      if (error) {
        console.error('Erreur création transaction:', error);
        throw new BadRequestException('Erreur lors de la création de la transaction');
      }

      return {
        success: true as const,
        transaction,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Erreur création transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !transaction) {
        throw new NotFoundException('Transaction introuvable ou accès non autorisé');
      }

      return {
        success: true as const,
        transaction,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erreur récupération transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async update(
    id: string,
    updateTransactionDto: TransactionUpdateRequest,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionResponse> {
    try {
      const { data: transaction, error } = await supabase
        .from('transactions')
        .update({
          ...updateTransactionDto,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !transaction) {
        console.error('Erreur modification transaction:', error);
        throw new NotFoundException('Transaction introuvable ou modification non autorisée');
      }

      return {
        success: true as const,
        transaction,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erreur modification transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erreur suppression transaction:', error);
        throw new NotFoundException('Transaction introuvable ou suppression non autorisée');
      }

      return {
        success: true as const,
        message: 'Transaction supprimée avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erreur suppression transaction:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }
}