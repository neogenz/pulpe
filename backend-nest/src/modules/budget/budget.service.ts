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
  type BudgetCreate,
  type BudgetCreateFromOnboarding,
  type BudgetCreateFromTemplate,
  type BudgetDeleteResponse,
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetUpdate,
} from '@pulpe/shared';
import { BudgetMapper } from './budget.mapper';
import { type Database, type Tables } from '../../types/database.types';
import { BudgetRow } from '../../types/supabase-helpers';
import { ErrorDictionary } from '../../common/constants/error-codes';
import { BUDGET_CONSTANTS } from './budget.constants';

@Injectable()
export class BudgetService {
  constructor(
    @InjectPinoLogger(BudgetService.name)
    private readonly logger: PinoLogger,
    private readonly budgetMapper: BudgetMapper,
  ) {}

  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetListResponse> {
    try {
      const { data: budgets, error } = await supabase
        .from('monthly_budget')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) {
        this.logger.error({ err: error }, 'Failed to fetch budgets');
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des budgets',
        );
      }

      const apiData = this.budgetMapper.toApiList(budgets || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to list budgets');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateCreateBudgetDto(createBudgetDto: BudgetCreate): BudgetCreate {
    // Validation métier basique (Supabase gère les contraintes de DB)
    if (
      !createBudgetDto.month ||
      !createBudgetDto.year ||
      !createBudgetDto.description
    ) {
      throw new BadRequestException('Données requises manquantes');
    }

    if (
      createBudgetDto.month < BUDGET_CONSTANTS.MONTH_MIN ||
      createBudgetDto.month > BUDGET_CONSTANTS.MONTH_MAX
    ) {
      throw new BadRequestException('Mois invalide');
    }

    if (
      createBudgetDto.year < BUDGET_CONSTANTS.MIN_YEAR ||
      createBudgetDto.year > BUDGET_CONSTANTS.MAX_YEAR
    ) {
      throw new BadRequestException('Année invalide');
    }

    if (
      createBudgetDto.description.length >
      BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH
    ) {
      throw new BadRequestException(
        `Description ne peut pas dépasser ${BUDGET_CONSTANTS.DESCRIPTION_MAX_LENGTH} caractères`,
      );
    }

    // Validation métier : pas plus de 2 ans dans le futur
    const now = new Date();
    const budgetDate = new Date(
      createBudgetDto.year,
      createBudgetDto.month - 1,
    );
    const maxFutureDate = new Date(now.getFullYear() + 2, now.getMonth());
    if (budgetDate > maxFutureDate) {
      throw new BadRequestException(
        'Budget ne peut pas être créé plus de 2 ans dans le futur',
      );
    }

    return createBudgetDto;
  }

  private prepareBudgetData(createBudgetDto: BudgetCreate, userId: string) {
    return {
      ...createBudgetDto,
      user_id: userId,
      template_id: createBudgetDto.templateId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertBudget(
    budgetData: ReturnType<typeof this.prepareBudgetData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data: budgetDb, error } = await supabase
      .from('monthly_budget')
      .insert(budgetData)
      .select()
      .single();

    if (error) {
      this.logger.error({ err: error }, 'Failed to create budget');
      throw new BadRequestException('Erreur lors de la création du budget');
    }

    return budgetDb;
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

      const budgetData = this.prepareBudgetData(createBudgetDto, user.id);
      const budgetDb = await this.insertBudget(budgetData, supabase);

      const apiData = this.budgetMapper.toApi(
        budgetDb as Tables<'monthly_budget'>,
      );

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to create budget');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const { data: budgetDb, error } = await supabase
        .from('monthly_budget')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !budgetDb) {
        throw new NotFoundException('Budget introuvable ou accès non autorisé');
      }

      const apiData = this.budgetMapper.toApi(
        budgetDb as Tables<'monthly_budget'>,
      );

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to fetch budget');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateUpdateBudgetDto(updateBudgetDto: BudgetUpdate): BudgetUpdate {
    // Validation basique pour les champs optionnels
    if (
      updateBudgetDto.month !== undefined &&
      (updateBudgetDto.month < BUDGET_CONSTANTS.MONTH_MIN ||
        updateBudgetDto.month > BUDGET_CONSTANTS.MONTH_MAX)
    ) {
      throw new BadRequestException('Mois invalide');
    }

    if (
      updateBudgetDto.year !== undefined &&
      (updateBudgetDto.year < BUDGET_CONSTANTS.MIN_YEAR ||
        updateBudgetDto.year > BUDGET_CONSTANTS.MAX_YEAR)
    ) {
      throw new BadRequestException('Année invalide');
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
      this.logger.error({ err: error }, 'Failed to update budget');
      throw new NotFoundException(
        'Budget introuvable ou modification non autorisée',
      );
    }

    return budgetDb;
  }

  async update(
    id: string,
    updateBudgetDto: BudgetUpdate,
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

      const apiData = this.budgetMapper.toApi(
        budgetDb as Tables<'monthly_budget'>,
      );

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
      this.logger.error({ err: error }, 'Failed to update budget');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDeleteResponse> {
    try {
      const { error } = await supabase
        .from('monthly_budget')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error({ err: error }, 'Failed to delete budget');
        throw new NotFoundException(
          'Budget introuvable ou suppression non autorisée',
        );
      }

      return {
        success: true,
        message: 'Budget supprimé avec succès',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to delete budget');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private prepareOnboardingRpcParams(
    onboardingData: BudgetCreateFromOnboarding,
    userId: string,
  ): Database['public']['Functions']['create_budget_from_onboarding_with_transactions']['Args'] {
    return {
      p_user_id: userId,
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

  private async executeOnboardingRpc(
    rpcParams: ReturnType<typeof this.prepareOnboardingRpcParams>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<unknown> {
    const { data, error } = await supabase.rpc(
      'create_budget_from_onboarding_with_transactions',
      rpcParams,
    );

    if (error) {
      this.logger.error(
        { err: error },
        'Failed to create budget from onboarding',
      );
      throw new BadRequestException(
        'Erreur lors de la création du budget et des transactions',
      );
    }

    if (!data || typeof data !== 'object' || !('budget' in data)) {
      throw new InternalServerErrorException(
        'Aucun budget retourné par la fonction',
      );
    }

    return data;
  }

  async createFromOnboarding(
    onboardingData: BudgetCreateFromOnboarding,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      const rpcParams = this.prepareOnboardingRpcParams(
        onboardingData,
        user.id,
      );
      const data = await this.executeOnboardingRpc(rpcParams, supabase);

      const apiData = this.budgetMapper.toApi(
        (data as { budget: Tables<'monthly_budget'> }).budget,
      );

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }
      this.logger.error(
        { err: error },
        'Failed to create budget from onboarding',
      );
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private async validateTemplateExists(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data: template, error } = await supabase
      .from('template')
      .select('id')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      throw new NotFoundException(ErrorDictionary.TEMPLATE_NOT_FOUND);
    }
  }

  private async getTemplateLines(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    const { data: templateLines, error } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: true });

    if (error) {
      this.logger.error({ err: error }, 'Failed to fetch template lines');
      throw new InternalServerErrorException(
        ErrorDictionary.TEMPLATE_LINES_FETCH_FAILED,
      );
    }

    return templateLines || [];
  }

  private prepareBudgetFromTemplateData(
    templateData: BudgetCreateFromTemplate,
    userId: string,
  ) {
    const now = new Date().toISOString();
    return {
      month: templateData.month,
      year: templateData.year,
      description: templateData.description,
      user_id: userId,
      template_id: templateData.templateId,
      created_at: now,
      updated_at: now,
      templateId: templateData.templateId,
    };
  }

  private async createTransactionsFromTemplateLines(
    budgetId: string,
    templateLines: Tables<'template_line'>[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    if (templateLines.length === 0) {
      return;
    }

    const transactions = templateLines.map((line) => ({
      amount: line.amount,
      type: line.kind,
      name: line.name,
      description: line.description || '',
      expense_type: line.recurrence,
      is_recurring: line.recurrence === 'fixed',
      budget_id: budgetId,
    }));

    const { error } = await supabase.from('transaction').insert(transactions);

    if (error) {
      this.logger.error(
        { err: error },
        'Failed to create transactions from template lines',
      );
      await supabase.from('monthly_budget').delete().eq('id', budgetId);
      throw new BadRequestException(
        ErrorDictionary.TEMPLATE_TRANSACTIONS_CREATE_FAILED,
      );
    }
  }

  private async performTemplateValidations(
    templateData: BudgetCreateFromTemplate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    await this.validateTemplateExists(templateData.templateId, supabase);
    await this.validateNoDuplicatePeriod(
      supabase,
      templateData.month,
      templateData.year,
    );
  }

  private async createBudgetFromValidatedTemplate(
    templateData: BudgetCreateFromTemplate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    const templateLines = await this.getTemplateLines(
      templateData.templateId,
      supabase,
    );

    const budgetData = this.prepareBudgetFromTemplateData(
      templateData,
      user.id,
    );
    const budgetDb = await this.insertBudget(budgetData, supabase);
    const budget = this.validateBudgetData(budgetDb);

    await this.createTransactionsFromTemplateLines(
      budget.id,
      templateLines,
      supabase,
    );

    const apiData = this.budgetMapper.toApi(budget);
    return { success: true, data: apiData };
  }

  async createFromTemplate(
    templateData: BudgetCreateFromTemplate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetResponse> {
    try {
      await this.performTemplateValidations(templateData, supabase);
      return await this.createBudgetFromValidatedTemplate(
        templateData,
        user,
        supabase,
      );
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        { err: error },
        'Failed to create budget from template',
      );
      throw new InternalServerErrorException(
        ErrorDictionary.TEMPLATE_CREATE_FAILED.message,
      );
    }
  }

  private filterValidBudgets(rawBudgets: unknown[]): BudgetRow[] {
    return rawBudgets
      .map((rawBudget) => {
        try {
          return this.validateBudgetData(rawBudget);
        } catch {
          this.logger.warn(
            { data: rawBudget },
            'Invalid budget data filtered out',
          );
          return null;
        }
      })
      .filter((budget): budget is BudgetRow => budget !== null)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }

  private validateBudgetData(rawBudget: unknown): BudgetRow {
    if (!this.isValidBudgetRow(rawBudget)) {
      this.logger.error({ data: rawBudget }, 'Invalid budget data');
      throw new InternalServerErrorException('Données budget invalides');
    }

    return rawBudget;
  }

  private isValidBudgetRow(data: unknown): data is BudgetRow {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const budget = data as Record<string, unknown>;

    return (
      typeof budget.id === 'string' &&
      typeof budget.month === 'number' &&
      typeof budget.year === 'number' &&
      typeof budget.description === 'string' &&
      typeof budget.created_at === 'string' &&
      typeof budget.updated_at === 'string' &&
      (budget.user_id === null || typeof budget.user_id === 'string') &&
      (budget.template_id === null || typeof budget.template_id === 'string')
    );
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
      throw new BadRequestException('Un budget existe déjà pour cette période');
    }
  }
}
