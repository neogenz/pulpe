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
  type BudgetDeleteResponse,
  type BudgetListResponse,
  type BudgetResponse,
  type BudgetUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';
import { BudgetMapper } from './budget.mapper';
import { type Tables } from '../../types/database.types';
import { BUDGET_CONSTANTS } from './budget.constants';
import { TransactionMapper } from '../transaction/transaction.mapper';
import { BudgetLineMapper } from '../budget-line/budget-line.mapper';

@Injectable()
export class BudgetService {
  constructor(
    @InjectPinoLogger(BudgetService.name)
    private readonly logger: PinoLogger,
    private readonly budgetMapper: BudgetMapper,
    private readonly transactionMapper: TransactionMapper,
    private readonly budgetLineMapper: BudgetLineMapper,
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
      !createBudgetDto.description ||
      !createBudgetDto.templateId
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

      this.logger.info(
        {
          userId: user.id,
          templateId: validatedDto.templateId,
          month: validatedDto.month,
          year: validatedDto.year,
        },
        'Starting atomic budget creation from template',
      );

      // Use atomic database function to create budget with transactions
      // templateId is guaranteed to exist due to Zod schema validation and business validation
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
        this.logger.error(
          {
            err: error,
            userId: user.id,
            templateId: validatedDto.templateId,
          },
          'Atomic budget creation from template failed',
        );

        // Handle specific database errors with better error codes
        if (
          error.code === 'P0001' ||
          error.message?.includes('Template not found')
        ) {
          throw new NotFoundException(
            'Template introuvable ou accès non autorisé',
          );
        }
        if (
          error.code === 'P0002' ||
          error.message?.includes('Budget already exists')
        ) {
          throw new BadRequestException(
            'Un budget existe déjà pour cette période',
          );
        }

        throw new InternalServerErrorException(
          'Erreur lors de la création du budget à partir du template',
        );
      }

      if (!result || typeof result !== 'object' || !('budget' in result)) {
        this.logger.error(
          { result, userId: user.id, templateId: validatedDto.templateId },
          'Invalid result returned from create_budget_from_template',
        );
        throw new InternalServerErrorException(
          'Résultat invalide retourné par la fonction de création',
        );
      }

      const budgetData = result.budget as Tables<'monthly_budget'>;
      const budgetLinesCreated = result.budget_lines_created as number;
      const templateName = result.template_name as string;

      this.logger.info(
        {
          userId: user.id,
          budgetId: budgetData.id,
          templateId: validatedDto.templateId,
          templateName,
          budgetLinesCreated,
        },
        'Successfully created budget from template with atomic transaction',
      );

      const apiData = this.budgetMapper.toApi(budgetData);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
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

  async findOneWithDetails(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetDetailsResponse> {
    try {
      // Fetch budget, transactions, and budget lines in parallel for better performance
      const [budgetResult, transactionsResult, budgetLinesResult] =
        await Promise.all([
          supabase.from('monthly_budget').select('*').eq('id', id).single(),
          supabase
            .from('transaction')
            .select('*')
            .eq('budget_id', id)
            .order('transaction_date', { ascending: false }),
          supabase
            .from('budget_line')
            .select('*')
            .eq('budget_id', id)
            .order('created_at', { ascending: false }),
        ]);

      // Check if budget exists and user has access
      if (budgetResult.error || !budgetResult.data) {
        this.logger.warn(
          { budgetId: id, error: budgetResult.error },
          'Budget not found or access denied',
        );
        throw new NotFoundException('Budget introuvable ou accès non autorisé');
      }

      // Log any errors for transactions or budget lines (but don't fail the request)
      if (transactionsResult.error) {
        this.logger.error(
          { err: transactionsResult.error, budgetId: id },
          'Failed to fetch transactions for budget',
        );
      }

      if (budgetLinesResult.error) {
        this.logger.error(
          { err: budgetLinesResult.error, budgetId: id },
          'Failed to fetch budget lines for budget',
        );
      }

      // Map the data to API format
      const budget = this.budgetMapper.toApi(
        budgetResult.data as Tables<'monthly_budget'>,
      );

      const transactions = this.transactionMapper.toApiList(
        transactionsResult.data || [],
      );
      const budgetLines = this.budgetLineMapper.toApiList(
        budgetLinesResult.data || [],
      );

      this.logger.info(
        {
          budgetId: id,
          transactionCount: transactions.length,
          budgetLineCount: budgetLines.length,
        },
        'Successfully fetched budget with details',
      );

      return {
        success: true,
        data: {
          budget,
          transactions,
          budgetLines,
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        { err: error, budgetId: id },
        'Failed to fetch budget with details',
      );
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
