import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Injectable } from '@nestjs/common';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { BusinessException } from '@common/exceptions/business.exception';
import { handleServiceError } from '@common/utils/error-handler';
import {
  type BudgetLineCreate,
  type BudgetLineListResponse,
  type BudgetLineResponse,
  type BudgetLineUpdate,
  type BudgetLineDeleteResponse,
  type TransactionListResponse,
} from 'pulpe-shared';
import * as budgetLineMappers from './budget-line.mappers';
import * as transactionMappers from '../transaction/transaction.mappers';
import type { Database } from '../../types/database.types';
import { BudgetService } from '../budget/budget.service';
import { EncryptionService } from '@modules/encryption/encryption.service';

@Injectable()
export class BudgetLineService {
  constructor(
    private readonly budgetService: BudgetService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async #decryptBudgetLine(
    budgetLine: Database['public']['Tables']['budget_line']['Row'],
    user: AuthenticatedUser,
  ): Promise<Database['public']['Tables']['budget_line']['Row']> {
    if (!('amount_encrypted' in budgetLine) || !budgetLine.amount_encrypted) {
      return budgetLine;
    }

    const dek = await this.encryptionService.getUserDEK(
      user.id,
      user.clientKey,
    );
    const decryptedAmount = this.encryptionService.tryDecryptAmount(
      budgetLine.amount_encrypted as string,
      dek,
      budgetLine.amount,
    );

    return {
      ...budgetLine,
      amount: decryptedAmount,
    };
  }

  async #decryptBudgetLines(
    budgetLines: Database['public']['Tables']['budget_line']['Row'][],
    user: AuthenticatedUser,
  ): Promise<Database['public']['Tables']['budget_line']['Row'][]> {
    return Promise.all(
      budgetLines.map((line) => this.#decryptBudgetLine(line, user)),
    );
  }

  async #encryptAmount(
    amount: number,
    user: AuthenticatedUser,
  ): Promise<string> {
    const dek = await this.encryptionService.ensureUserDEK(
      user.id,
      user.clientKey,
    );
    return this.encryptionService.encryptAmount(amount, dek);
  }

  async findAll(
    user: AuthenticatedUser,
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

      const decryptedLines = await this.#decryptBudgetLines(
        budgetLinesDb || [],
        user,
      );
      const apiData = budgetLineMappers.toApiList(decryptedLines);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetLines',
          entityType: 'budget_line',
        },
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
    const amountEncrypted = await this.#encryptAmount(
      budgetLineData.amount,
      user,
    );
    const dataWithEncryption = {
      ...budgetLineData,
      amount: 0,
      amount_encrypted: amountEncrypted,
    };

    const { data: budgetLineDb, error } = await supabase
      .from('budget_line')
      .insert(dataWithEncryption)
      .select()
      .single();

    if (error) {
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

      const decryptedBudgetLine = await this.#decryptBudgetLine(
        budgetLineDb,
        user,
      );

      await this.budgetService.recalculateBalances(
        budgetLineDb.budget_id,
        supabase,
        user.clientKey,
      );

      const apiData = budgetLineMappers.toApi(decryptedBudgetLine);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        {
          operation: 'createBudgetLine',
          userId: user.id,
          entityType: 'budget_line',
        },
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
      const decryptedBudgetLine = await this.#decryptBudgetLine(
        budgetLineDb,
        user,
      );
      const apiData = budgetLineMappers.toApi(decryptedBudgetLine);

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
    handleServiceError(
      error,
      ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
      undefined,
      {
        operation: 'getBudgetLine',
        userId: user.id,
        entityId: id,
        entityType: 'budget_line',
      },
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

      let updateData = this.prepareBudgetLineUpdateData(updateBudgetLineDto);
      if (updateBudgetLineDto.amount !== undefined) {
        const amountEncrypted = await this.#encryptAmount(
          updateBudgetLineDto.amount,
          user,
        );
        updateData = {
          ...updateData,
          amount: 0,
          amount_encrypted: amountEncrypted,
        };
      }

      const budgetLineDb = await this.updateBudgetLineInDb(
        id,
        updateData,
        supabase,
        user,
      );

      const decryptedBudgetLine = await this.#decryptBudgetLine(
        budgetLineDb,
        user,
      );

      await this.budgetService.recalculateBalances(
        budgetLineDb.budget_id,
        supabase,
        user.clientKey,
      );

      const apiData = budgetLineMappers.toApi(decryptedBudgetLine);

      return {
        success: true,
        data: apiData,
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        { id },
        {
          operation: 'updateBudgetLine',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
        },
      );
    }
  }

  async remove(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineDeleteResponse> {
    try {
      const { data: budgetLine } = await supabase
        .from('budget_line')
        .select('budget_id')
        .eq('id', id)
        .single();
      await this.deleteBudgetLine(id, user, supabase);

      if (budgetLine?.budget_id) {
        await this.budgetService.recalculateBalances(
          budgetLine.budget_id,
          supabase,
          user.clientKey,
        );
      }

      return {
        success: true,
        message: 'Budget line deleted successfully',
      };
    } catch (error) {
      this.handleRemovalError(error, id, user);
    }
  }

  private async deleteBudgetLine(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
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

    return;
  }

  private handleRemovalError(
    error: unknown,
    id: string,
    user: AuthenticatedUser,
  ): never {
    handleServiceError(
      error,
      ERROR_DEFINITIONS.BUDGET_LINE_DELETE_FAILED,
      { id },
      {
        operation: 'deleteBudgetLine',
        userId: user.id,
        entityId: id,
        entityType: 'budget_line',
      },
    );
  }

  async resetFromTemplate(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      const budgetLine = await this.fetchBudgetLineById(id, user, supabase);
      this.validateTemplateLineIdExists(budgetLine.template_line_id);

      const templateLine = await this.fetchTemplateLineById(
        budgetLine.template_line_id!,
        supabase,
        user,
      );

      let updateData = this.prepareResetUpdateData(templateLine);
      const amountEncrypted = await this.#encryptAmount(
        templateLine.amount,
        user,
      );
      updateData = {
        ...updateData,
        amount: 0,
        amount_encrypted: amountEncrypted,
      };

      const updatedBudgetLine = await this.updateBudgetLineInDb(
        id,
        updateData,
        supabase,
        user,
      );

      const decryptedBudgetLine = await this.#decryptBudgetLine(
        updatedBudgetLine,
        user,
      );

      await this.budgetService.recalculateBalances(
        updatedBudgetLine.budget_id,
        supabase,
        user.clientKey,
      );

      return {
        success: true,
        data: budgetLineMappers.toApi(decryptedBudgetLine),
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        { id },
        {
          operation: 'resetFromTemplate',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
        },
      );
    }
  }

  private validateTemplateLineIdExists(templateLineId: string | null): void {
    if (!templateLineId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_VALIDATION_FAILED,
        { reason: 'Budget line has no associated template' },
      );
    }
  }

  private prepareResetUpdateData(templateLine: {
    name: string;
    amount: number;
    kind: Database['public']['Enums']['transaction_kind'];
    recurrence: Database['public']['Enums']['transaction_recurrence'];
  }): Database['public']['Tables']['budget_line']['Update'] {
    return {
      name: templateLine.name,
      amount: templateLine.amount,
      kind: templateLine.kind,
      recurrence: templateLine.recurrence,
      is_manually_adjusted: false,
      updated_at: new Date().toISOString(),
    };
  }

  private async fetchTemplateLineById(
    templateLineId: string,
    supabase: AuthenticatedSupabaseClient,
    user: AuthenticatedUser,
  ) {
    const { data: templateLine, error } = await supabase
      .from('template_line')
      .select('name, amount, amount_encrypted, kind, recurrence')
      .eq('id', templateLineId)
      .single();

    if (error || !templateLine) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: templateLineId,
      });
    }

    if (templateLine.amount_encrypted) {
      const dek = await this.encryptionService.getUserDEK(
        user.id,
        user.clientKey,
      );
      return {
        ...templateLine,
        amount: this.encryptionService.tryDecryptAmount(
          templateLine.amount_encrypted,
          dek,
          templateLine.amount,
        ),
      };
    }

    return templateLine;
  }

  async toggleCheck(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineResponse> {
    try {
      const { data: updatedBudgetLine, error } = await supabase
        .rpc('toggle_budget_line_check', {
          p_budget_line_id: id,
        })
        .single();

      if (error || !updatedBudgetLine) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
          undefined,
          {
            operation: 'toggleCheck',
            userId: user.id,
            entityId: id,
            entityType: 'budget_line',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      const decryptedBudgetLine = await this.#decryptBudgetLine(
        updatedBudgetLine,
        user,
      );

      return {
        success: true,
        data: budgetLineMappers.toApi(decryptedBudgetLine),
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        { id },
        {
          operation: 'toggleCheck',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
        },
      );
    }
  }

  async checkTransactions(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionListResponse> {
    try {
      const { data: updatedTransactions, error } = await supabase.rpc(
        'check_unchecked_transactions',
        { p_budget_line_id: id },
      );

      if (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
          undefined,
          {
            operation: 'checkTransactions',
            userId: user.id,
            entityId: id,
            entityType: 'budget_line',
            supabaseError: error,
          },
          { cause: error },
        );
      }

      return {
        success: true,
        data: transactionMappers.toApiList(updatedTransactions ?? []),
      };
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        { id },
        {
          operation: 'checkTransactions',
          userId: user.id,
          entityId: id,
          entityType: 'budget_line',
        },
      );
    }
  }

  async findByBudgetId(
    budgetId: string,
    user: AuthenticatedUser,
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

      const decryptedLines = await this.#decryptBudgetLines(
        budgetLinesDb || [],
        user,
      );
      const apiData = budgetLineMappers.toApiList(decryptedLines);

      return {
        success: true as const,
        data: apiData,
      } as BudgetLineListResponse;
    } catch (error) {
      handleServiceError(
        error,
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetLinesByBudget',
          entityId: budgetId,
          entityType: 'budget_line',
        },
      );
    }
  }
}
