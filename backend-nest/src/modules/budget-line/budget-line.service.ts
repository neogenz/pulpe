import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import {
  type BudgetLineCreate,
  type BudgetLineListResponse,
  type BudgetLineResponse,
  type BudgetLineUpdate,
  type BudgetLineDeleteResponse,
} from '@pulpe/shared';
import { BudgetLineMapper } from './budget-line.mapper';
import type { Database } from '../../types/database.types';

@Injectable()
export class BudgetLineService {
  constructor(
    @InjectPinoLogger(BudgetLineService.name)
    private readonly logger: PinoLogger,
    private readonly budgetLineMapper: BudgetLineMapper,
  ) {}

  /**
   * Validates budget line access for the authenticated user
   * Budget lines are user-owned through their parent budget
   * @param budgetLineId - The budget line ID to validate
   * @param user - The authenticated user
   * @param supabase - The authenticated Supabase client
   */
  private async validateBudgetLineAccess(
    budgetLineId: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { data, error } = await supabase
      .from('budget_line')
      .select(
        `
        id,
        name,
        budget_id,
        monthly_budget!inner (
          id,
          user_id,
          description
        )
      `,
      )
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      this.logger.warn(
        { budgetLineId, userId: user.id, error },
        'Budget line access validation failed - budget line not found',
      );
      throw new NotFoundException('Budget line not found');
    }

    const isOwner = data.monthly_budget.user_id === user.id;

    if (!isOwner) {
      this.logger.warn(
        {
          budgetLineId,
          userId: user.id,
          budgetOwnerId: data.monthly_budget.user_id,
          budgetLineName: data.name,
          budgetDescription: data.monthly_budget.description,
        },
        'Budget line access validation failed - not the owner',
      );
      throw new ForbiddenException('You can only access your own budget lines');
    }

    this.logger.debug(
      { budgetLineId, userId: user.id },
      'Budget line access validated successfully',
    );
  }

  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineListResponse> {
    try {
      const { data: budgetLinesDb, error } = await supabase
        .from('budget_line')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error({ err: error }, 'Failed to fetch budget lines');
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des lignes budgétaires',
        );
      }

      const apiData = this.budgetLineMapper.toApiList(budgetLinesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to list budget lines');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findByBudgetId(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineListResponse> {
    try {
      const { data: budgetLinesDb, error } = await supabase
        .from('budget_line')
        .select('*')
        .eq('budget_id', budgetId)
        .order('created_at', { ascending: false });

      if (error) {
        this.logger.error(
          { err: error },
          'Failed to fetch budget lines by budget',
        );
        throw new InternalServerErrorException(
          'Erreur lors de la récupération des lignes budgétaires',
        );
      }

      const apiData = this.budgetLineMapper.toApiList(budgetLinesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        { err: error },
        'Failed to list budget lines by budget',
      );
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      await this.validateBudgetLineAccess(id, user, supabase);

      const { data: budgetLineDb, error } = await supabase
        .from('budget_line')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !budgetLineDb) {
        throw new NotFoundException(
          'Ligne budgétaire introuvable ou accès non autorisé',
        );
      }

      const apiData = this.budgetLineMapper.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to fetch single budget line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateCreateBudgetLineDto(
    createBudgetLineDto: BudgetLineCreate,
  ): void {
    if (!createBudgetLineDto.budgetId) {
      throw new BadRequestException('Budget ID est requis');
    }

    if (!createBudgetLineDto.amount || createBudgetLineDto.amount <= 0) {
      throw new BadRequestException('Montant doit être positif');
    }

    if (
      !createBudgetLineDto.name ||
      createBudgetLineDto.name.trim().length === 0
    ) {
      throw new BadRequestException('Nom est requis');
    }

    if (createBudgetLineDto.name.length > 100) {
      throw new BadRequestException('Nom ne peut pas dépasser 100 caractères');
    }
  }

  private prepareBudgetLineData(createBudgetLineDto: BudgetLineCreate) {
    if (!createBudgetLineDto.budgetId) {
      throw new BadRequestException('Budget ID est requis');
    }

    return {
      budget_id: createBudgetLineDto.budgetId,
      template_line_id: createBudgetLineDto.templateLineId || null,
      savings_goal_id: createBudgetLineDto.savingsGoalId || null,
      name: createBudgetLineDto.name,
      amount: createBudgetLineDto.amount,
      kind: createBudgetLineDto.kind,
      recurrence: createBudgetLineDto.recurrence,
      is_manually_adjusted: createBudgetLineDto.isManuallyAdjusted || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertBudgetLine(
    budgetLineData: ReturnType<typeof this.prepareBudgetLineData>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Database['public']['Tables']['budget_line']['Row']> {
    const { data: budgetLineDb, error } = await supabase
      .from('budget_line')
      .insert(budgetLineData)
      .select()
      .single();

    if (error) {
      this.logger.error({ err: error }, 'Failed to create budget line');
      throw new BadRequestException(
        'Erreur lors de la création de la ligne budgétaire',
      );
    }

    return budgetLineDb;
  }

  async create(
    createBudgetLineDto: BudgetLineCreate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      this.validateCreateBudgetLineDto(createBudgetLineDto);

      const budgetLineData = this.prepareBudgetLineData(createBudgetLineDto);
      const budgetLineDb = await this.insertBudgetLine(
        budgetLineData,
        supabase,
      );

      const apiData = this.budgetLineMapper.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to create budget line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  private validateUpdateBudgetLineDto(
    updateBudgetLineDto: BudgetLineUpdate,
  ): void {
    if (updateBudgetLineDto.amount !== undefined) {
      if (updateBudgetLineDto.amount <= 0) {
        throw new BadRequestException('Montant doit être positif');
      }
    }

    if (updateBudgetLineDto.name !== undefined) {
      if (updateBudgetLineDto.name.trim().length === 0) {
        throw new BadRequestException('Nom ne peut pas être vide');
      }
      if (updateBudgetLineDto.name.length > 100) {
        throw new BadRequestException(
          'Nom ne peut pas dépasser 100 caractères',
        );
      }
    }
  }

  private prepareBudgetLineUpdateData(
    updateBudgetLineDto: BudgetLineUpdate,
  ): Record<string, unknown> {
    return {
      ...(updateBudgetLineDto.templateLineId !== undefined && {
        template_line_id: updateBudgetLineDto.templateLineId,
      }),
      ...(updateBudgetLineDto.savingsGoalId !== undefined && {
        savings_goal_id: updateBudgetLineDto.savingsGoalId,
      }),
      ...(updateBudgetLineDto.name && { name: updateBudgetLineDto.name }),
      ...(updateBudgetLineDto.amount && { amount: updateBudgetLineDto.amount }),
      ...(updateBudgetLineDto.kind && { kind: updateBudgetLineDto.kind }),
      ...(updateBudgetLineDto.recurrence && {
        recurrence: updateBudgetLineDto.recurrence,
      }),
      ...(updateBudgetLineDto.isManuallyAdjusted !== undefined && {
        is_manually_adjusted: updateBudgetLineDto.isManuallyAdjusted,
      }),
      updated_at: new Date().toISOString(),
    };
  }

  private async updateBudgetLineInDb(
    id: string,
    updateData: Record<string, unknown>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Database['public']['Tables']['budget_line']['Row']> {
    const { data: budgetLineDb, error } = await supabase
      .from('budget_line')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !budgetLineDb) {
      this.logger.error({ err: error }, 'Failed to update budget line');
      throw new NotFoundException(
        'Ligne budgétaire introuvable ou modification non autorisée',
      );
    }

    return budgetLineDb;
  }

  async update(
    id: string,
    updateBudgetLineDto: BudgetLineUpdate,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      await this.validateBudgetLineAccess(id, user, supabase);

      this.validateUpdateBudgetLineDto(updateBudgetLineDto);

      const updateData = this.prepareBudgetLineUpdateData(updateBudgetLineDto);
      const budgetLineDb = await this.updateBudgetLineInDb(
        id,
        updateData,
        supabase,
      );

      const apiData = this.budgetLineMapper.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to update budget line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineDeleteResponse> {
    try {
      await this.validateBudgetLineAccess(id, user, supabase);

      const { error } = await supabase
        .from('budget_line')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error({ err: error }, 'Failed to delete budget line');
        throw new NotFoundException(
          'Ligne budgétaire introuvable ou suppression non autorisée',
        );
      }

      return {
        success: true,
        message: 'Ligne budgétaire supprimée avec succès',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      this.logger.error({ err: error }, 'Failed to delete budget line');
      throw new InternalServerErrorException('Erreur interne du serveur');
    }
  }
}
