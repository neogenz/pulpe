import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type BudgetCreateFromOnboarding,
  type BudgetCreate,
  type BudgetUpdate,
  type BudgetResponse,
  type BudgetListResponse,
  type BudgetDeleteResponse,
} from '@pulpe/shared';
import { BudgetMapper, type BudgetDbEntity } from './budget.mapper';

@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);

  constructor(private readonly budgetMapper: BudgetMapper) {}
  async findAll(
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetListResponse> {
    try {
      const { data: budgetsDb, error } = await supabase
        .from('budgets')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        this.logger.error('Erreur récupération budgets:', error);
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des budgets',
        );
      }

      const budgets = this.budgetMapper.toApiList(budgetsDb || []);

      return {
        success: true as const,
        data: budgets,
      };
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error('Erreur liste budgets:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async create(
    createBudgetDto: BudgetCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const budgetData = this.budgetMapper.toDbCreate(createBudgetDto, user.id);

      const { data: budgetDb, error } = await supabase
        .from('budgets')
        .insert(budgetData)
        .select()
        .single();

      if (error) {
        this.logger.error('Erreur création budget:', error);
        throw new BadRequestException('Erreur lors de la création du budget');
      }

      const budget = this.budgetMapper.toApi(budgetDb as BudgetDbEntity);

      return {
        success: true as const,
        data: budget,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error('Erreur création budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const { data: budgetDb, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !budgetDb) {
        throw new NotFoundException('Budget introuvable ou accès non autorisé');
      }

      const budget = this.budgetMapper.toApi(budgetDb as BudgetDbEntity);

      return {
        success: true as const,
        data: budget,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur récupération budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async update(
    id: string,
    updateBudgetDto: BudgetUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const updateData = {
        ...this.budgetMapper.toDbUpdate(updateBudgetDto),
        updated_at: new Date().toISOString(),
      };

      const { data: budgetDb, error } = await supabase
        .from('budgets')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !budgetDb) {
        this.logger.error('Erreur modification budget:', error);
        throw new NotFoundException(
          'Budget introuvable ou modification non autorisée',
        );
      }

      const budget = this.budgetMapper.toApi(budgetDb as BudgetDbEntity);

      return {
        success: true as const,
        data: budget,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur modification budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDeleteResponse> {
    try {
      const { error } = await supabase.from('budgets').delete().eq('id', id);

      if (error) {
        this.logger.error('Erreur suppression budget:', error);
        throw new NotFoundException(
          'Budget introuvable ou suppression non autorisée',
        );
      }

      return {
        success: true as const,
        message: 'Budget supprimé avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error('Erreur suppression budget:', error);
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async createFromOnboarding(
    onboardingData: BudgetCreateFromOnboarding,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const rpcParams = this.buildOnboardingRpcParams(onboardingData);
      const { data, error } = await supabase.rpc(
        'create_budget_from_onboarding_with_transactions',
        rpcParams,
      );

      this.validateOnboardingResponse(data, error);
      const budget = this.budgetMapper.toApi(data.budget as BudgetDbEntity);

      return {
        success: true as const,
        data: budget,
      };
    } catch (error) {
      this.handleOnboardingError(error);
    }
  }

  private buildOnboardingRpcParams(onboardingData: BudgetCreateFromOnboarding) {
    return {
      p_month: onboardingData.month,
      p_year: onboardingData.year,
      p_description: onboardingData.description,
      p_monthly_income: onboardingData.monthlyIncome,
      p_housing_costs: onboardingData.housingCosts,
      p_health_insurance: onboardingData.healthInsurance,
      p_leasing_credit: onboardingData.leasingCredit,
      p_phone_plan: onboardingData.phonePlan,
      p_transport_costs: onboardingData.transportCosts,
    };
  }

  private validateOnboardingResponse(data: unknown, error: unknown): void {
    if (error) {
      this.logger.error('Erreur création budget avec transactions:', error);
      throw new BadRequestException(
        'Erreur lors de la création du budget et des transactions',
      );
    }

    if (!data?.budget) {
      throw new InternalServerErrorException(
        'Aucun budget retourné par la fonction',
      );
    }
  }

  private handleOnboardingError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }
    this.logger.error('Erreur création budget depuis onboarding:', error);
    throw new InternalServerErrorException('Erreur interne du serveur');
  }
}
