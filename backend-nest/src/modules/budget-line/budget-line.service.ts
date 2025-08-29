import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable, HttpException } from '@nestjs/common';
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
import { BudgetService } from '../budget/budget.service';

@Injectable()
export class BudgetLineService {
  constructor(
    @InjectPinoLogger(BudgetLineService.name)
    private readonly logger: PinoLogger,
    private readonly budgetService: BudgetService,
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
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
          undefined,
          {
            operation: 'listBudgetLines',
            entityType: 'budget_line',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      const apiData = budgetLineMappers.toApiList(budgetLinesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetLines',
          entityType: 'budget_line',
        },
        { cause: error },
      );
    }
  }

  private validateCreateBudgetLineDto(
    createBudgetLineDto: BudgetLineCreate,
  ): void {
    if (!createBudgetLineDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['budgetId'],
      });
    }

    if (!createBudgetLineDto.amount || createBudgetLineDto.amount < 0) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
        { reason: 'Amount must be greater than or equal to 0' },
      );
    }

    if (
      !createBudgetLineDto.name ||
      createBudgetLineDto.name.trim().length === 0
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['name'],
      });
    }
  }

  private prepareBudgetLineData(createBudgetLineDto: BudgetLineCreate) {
    // Manual conversion without Zod validation (already validated in service)
    if (!createBudgetLineDto.budgetId) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['budgetId'],
      });
    }

    return {
      budget_id: createBudgetLineDto.budgetId,
      template_line_id: createBudgetLineDto.templateLineId || null,
      savings_goal_id: createBudgetLineDto.savingsGoalId || null,
      name: createBudgetLineDto.name,
      amount: createBudgetLineDto.amount,
      kind: createBudgetLineDto.kind as Database['public']['Enums']['transaction_kind'],
      recurrence: createBudgetLineDto.recurrence,
      is_manually_adjusted: createBudgetLineDto.isManuallyAdjusted || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async insertBudgetLine(
    budgetLineData: ReturnType<typeof this.prepareBudgetLineData>,
    supabase: AuthenticatedSupabaseClient,
    user: AuthenticatedUser,
  ): Promise<Database['public']['Tables']['budget_line']['Row']> {
    const { data: budgetLineDb, error } = await supabase
      .from('budget_line')
      .insert(budgetLineData)
      .select()
      .single();

    if (error) {
      // Pattern "Enrichir et Relancer" - log technique + throw métier
      this.logger.error(
        {
          err: error,
          operation: 'createBudgetLine',
          userId: user.id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        'Supabase insert budget line failed',
      );

      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        {
          operation: 'createBudgetLine',
          userId: user.id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
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
        user,
      );

      const apiData = budgetLineMappers.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        {
          operation: 'createBudgetLine',
          userId: user.id,
          entityType: 'budget_line',
        },
        { cause: error },
      );
    }
  }

  async findOne(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      const budgetLineDb = await this.fetchBudgetLineById(id, user, supabase);
      const apiData = budgetLineMappers.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      this.handleFindOneError(error, id, user);
    }
  }

  private async fetchBudgetLineById(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data: budgetLineDb, error } = await supabase
      .from('budget_line')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !budgetLineDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'getBudgetLine',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }

    return budgetLineDb;
  }

  private handleFindOneError(
    error: unknown,
    id: string,
    user: AuthenticatedUser,
  ): never {
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
      undefined,
      {
        operation: 'getBudgetLine',
        userId: user.id,
        entityId: id,
        entityType: 'budget_line',
      },
      { cause: error },
    );
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
        { reason: 'Amount must be greater than or equal to 0' },
      );
    }

    if (
      updateBudgetLineDto.name !== undefined &&
      updateBudgetLineDto.name.trim().length === 0
    ) {
      throw new BusinessException(ERROR_DEFINITIONS.REQUIRED_DATA_MISSING, {
        fields: ['name'],
      });
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
        kind: updateBudgetLineDto.kind as Database['public']['Enums']['transaction_kind'],
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
    user: AuthenticatedUser,
  ): Promise<Database['public']['Tables']['budget_line']['Row']> {
    const { data: budgetLineDb, error } = await supabase
      .from('budget_line')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !budgetLineDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'updateBudgetLine',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
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
      this.validateUpdateBudgetLineDto(updateBudgetLineDto);

      const updateData = this.prepareBudgetLineUpdateData(updateBudgetLineDto);
      const budgetLineDb = await this.updateBudgetLineInDb(
        id,
        updateData,
        supabase,
        user,
      );

      // Recalculate ending balance for the budget immediately
      await this.budgetService.calculateAndPersistEndingBalance(
        budgetLineDb.budget_id,
        supabase,
      );

      const apiData = budgetLineMappers.toApi(budgetLineDb);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        { id },
        {
          operation: 'updateBudgetLine',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
        },
        { cause: error },
      );
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineDeleteResponse> {
    try {
      const budgetId = await this.deleteBudgetLineAndGetBudgetId(
        id,
        user,
        supabase,
      );
      await this.recalculateBudgetAfterDeletion(budgetId, supabase);

      return {
        success: true,
        message: 'Budget line deleted successfully',
      };
    } catch (error) {
      this.handleRemovalError(error, id, user);
    }
  }

  private async deleteBudgetLineAndGetBudgetId(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string | null> {
    // Get budget_id before deletion
    const { data: budgetLine } = await supabase
      .from('budget_line')
      .select('budget_id')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('budget_line').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'deleteBudgetLine',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return budgetLine?.budget_id || null;
  }

  private async recalculateBudgetAfterDeletion(
    budgetId: string | null,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    // Recalculate ending balance for the budget immediately
    if (budgetId) {
      await this.budgetService.calculateAndPersistEndingBalance(
        budgetId,
        supabase,
      );
    }
  }

  private handleRemovalError(
    error: unknown,
    id: string,
    user: AuthenticatedUser,
  ): never {
    if (error instanceof BusinessException || error instanceof HttpException) {
      throw error;
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_LINE_DELETE_FAILED,
      { id },
      {
        operation: 'deleteBudgetLine',
        userId: user.id,
        entityId: id,
        entityType: 'budget_line',
      },
      { cause: error },
    );
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
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
          undefined,
          {
            operation: 'listBudgetLinesByBudget',
            entityId: budgetId,
            entityType: 'budget_line',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      const apiData = budgetLineMappers.toApiList(budgetLinesDb || []);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      if (
        error instanceof BusinessException ||
        error instanceof HttpException
      ) {
        throw error;
      }
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetLinesByBudget',
          entityId: budgetId,
          entityType: 'budget_line',
        },
        { cause: error },
      );
    }
  }
}
