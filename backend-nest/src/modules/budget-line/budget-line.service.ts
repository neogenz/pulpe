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
  type BudgetLineCreate,
  type BudgetLineListResponse,
  type BudgetLineResponse,
  type BudgetLineUpdate,
  type BudgetLineDeleteResponse,
} from '@pulpe/shared';
import * as budgetLineMappers from './budget-line.mappers';
import type { Database } from '../../types/database.types';

@Injectable()
export class BudgetLineService {
  constructor(
    @InjectPinoLogger(BudgetLineService.name)
    private readonly logger: PinoLogger,
  ) {}

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
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED);
      }

      const apiData = budgetLineMappers.toApiList(budgetLinesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED);
    }
  }

  private validateCreateBudgetLineDto(
    createBudgetLineDto: BudgetLineCreate,
  ): void {
    if (!createBudgetLineDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
    }

    if (!createBudgetLineDto.amount || createBudgetLineDto.amount < 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
      );
    }

    if (
      !createBudgetLineDto.name ||
      createBudgetLineDto.name.trim().length === 0
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
    }
  }

  private prepareBudgetLineData(createBudgetLineDto: BudgetLineCreate) {
    if (!createBudgetLineDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
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
      if (error.message) {
        throw new BadRequestException(error.message);
      }
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED);
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

      const apiData = budgetLineMappers.toApi(budgetLineDb);

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
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED);
    }
  }

  async findOne(
    id: string,
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      const { data: budgetLineDb, error } = await supabase
        .from('budget_line')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !budgetLineDb) {
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND);
      }

      const apiData = budgetLineMappers.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to fetch single budget line');
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED);
    }
  }

  private validateUpdateBudgetLineDto(
    updateBudgetLineDto: BudgetLineUpdate,
  ): void {
    if (
      updateBudgetLineDto.amount !== undefined &&
      updateBudgetLineDto.amount < 0
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
      );
    }

    if (
      updateBudgetLineDto.name !== undefined &&
      updateBudgetLineDto.name.trim().length === 0
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING);
    }
  }

  private prepareBudgetLineUpdateData(
    updateBudgetLineDto: BudgetLineUpdate,
  ): Record<string, unknown> {
    return {
      ...(updateBudgetLineDto.name && { name: updateBudgetLineDto.name }),
      ...(updateBudgetLineDto.amount !== undefined && {
        amount: updateBudgetLineDto.amount,
      }),
      ...(updateBudgetLineDto.templateLineId !== undefined && {
        template_line_id: updateBudgetLineDto.templateLineId,
      }),
      ...(updateBudgetLineDto.savingsGoalId !== undefined && {
        savings_goal_id: updateBudgetLineDto.savingsGoalId,
      }),
      ...(updateBudgetLineDto.kind !== undefined && {
        kind: updateBudgetLineDto.kind,
      }),
      ...(updateBudgetLineDto.recurrence !== undefined && {
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
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND);
    }

    return budgetLineDb;
  }

  async update(
    id: string,
    updateBudgetLineDto: BudgetLineUpdate,
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      this.validateUpdateBudgetLineDto(updateBudgetLineDto);

      const updateData = this.prepareBudgetLineUpdateData(updateBudgetLineDto);
      const budgetLineDb = await this.updateBudgetLineInDb(
        id,
        updateData,
        supabase,
      );

      const apiData = budgetLineMappers.toApi(budgetLineDb);

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
      this.logger.error({ err: error }, 'Failed to update budget line');
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED);
    }
  }

  async remove(
    id: string,
    _user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineDeleteResponse> {
    try {
      const { error } = await supabase
        .from('budget_line')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error({ err: error }, 'Failed to delete budget line');
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND);
      }

      return {
        success: true,
        message: 'Budget line deleted successfully',
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_DELETE_FAILED);
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
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED);
      }

      const apiData = budgetLineMappers.toApiList(budgetLinesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      this.logger.error(
        { err: error },
        'Failed to list budget lines by budget',
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof BusinessException
      ) {
        throw error;
      }
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED);
    }
  }
}
