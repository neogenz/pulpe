import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import {
  type BudgetCreateRequest,
  type BudgetUpdateRequest,
  type BudgetInsert,
} from '@pulpe/shared';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { 
  BudgetListResponseDto, 
  BudgetResponseDto, 
  BudgetDeleteResponseDto 
} from './dto/budget-response.dto';

@Injectable()
export class BudgetService {
  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetListResponseDto> {
    try {
      const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        console.error('Erreur récupération budgets:', error);
        throw new InternalServerErrorException('Erreur lors de la récupération des budgets');
      }

      return {
        success: true as const,
        budgets: budgets || [],
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error('Erreur liste budgets:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async create(
    createBudgetDto: BudgetCreateRequest,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponseDto> {
    try {
      const budgetData: BudgetInsert = {
        ...createBudgetDto,
        user_id: user.id,
      };

      const { data: budget, error } = await supabase
        .from('budgets')
        .insert(budgetData)
        .select()
        .single();

      if (error) {
        console.error('Erreur création budget:', error);
        throw new BadRequestException('Erreur lors de la création du budget');
      }

      return {
        success: true as const,
        budget,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Erreur création budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponseDto> {
    try {
      const { data: budget, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !budget) {
        throw new NotFoundException('Budget introuvable ou accès non autorisé');
      }

      return {
        success: true as const,
        budget,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erreur récupération budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async update(
    id: string,
    updateBudgetDto: BudgetUpdateRequest,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponseDto> {
    try {
      const { data: budget, error } = await supabase
        .from('budgets')
        .update({
          ...updateBudgetDto,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !budget) {
        console.error('Erreur modification budget:', error);
        throw new NotFoundException('Budget introuvable ou modification non autorisée');
      }

      return {
        success: true as const,
        budget,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erreur modification budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDeleteResponseDto> {
    try {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Erreur suppression budget:', error);
        throw new NotFoundException('Budget introuvable ou suppression non autorisée');
      }

      return {
        success: true as const,
        message: 'Budget supprimé avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Erreur suppression budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }
}