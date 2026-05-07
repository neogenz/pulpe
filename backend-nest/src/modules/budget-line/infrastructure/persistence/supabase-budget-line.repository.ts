import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLineRepositoryPort } from '../../domain/ports/budget-line-repository.port';
import type {
  BudgetLineRow,
  BudgetLineInsert,
  BudgetLineUpdate,
  TemplateLineRow,
  TransactionRow,
} from '../../domain/budget-line.entity';

@Injectable()
export class SupabaseBudgetLineRepository implements BudgetLineRepositoryPort {
  async findAll(
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow[]> {
    const { data, error } = await supabase
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

    return data ?? [];
  }

  async findById(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow> {
    const { data, error } = await supabase
      .from('budget_line')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'getBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }

    return data;
  }

  async findByBudgetId(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow[]> {
    const { data, error } = await supabase
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

    return data ?? [];
  }

  async fetchBudgetIdForLine(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string | null> {
    const { data } = await supabase
      .from('budget_line')
      .select('budget_id')
      .eq('id', id)
      .single();

    return data?.budget_id ?? null;
  }

  async insert(
    data: BudgetLineInsert,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow> {
    const { data: row, error } = await supabase
      .from('budget_line')
      .insert(data)
      .select()
      .single();

    if (error) {
      const loggingContext = {
        operation: 'createBudgetLine',
        entityType: 'budget_line',
        supabaseError: error,
      };

      if (error.code === '23505') {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_EXISTS,
          { id: data.id },
          loggingContext,
          { cause: error },
        );
      }

      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        loggingContext,
        { cause: error },
      );
    }

    return row;
  }

  async update(
    id: string,
    data: Partial<BudgetLineUpdate>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow> {
    const { data: row, error } = await supabase
      .from('budget_line')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'updateBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return row;
  }

  async delete(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase.from('budget_line').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'deleteBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  async fetchTemplateLineById(
    templateLineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow> {
    const { data, error } = await supabase
      .from('template_line')
      .select(
        'name, amount, kind, recurrence, original_amount, original_currency, target_currency, exchange_rate, id, created_at, updated_at, description, template_id',
      )
      .eq('id', templateLineId)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: templateLineId,
      });
    }

    return data;
  }

  async toggleCheckRpc(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetLineRow> {
    const { data, error } = await supabase
      .rpc('toggle_budget_line_check', {
        p_budget_line_id: id,
      })
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        undefined,
        {
          operation: 'toggleCheck',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data;
  }

  async checkUncheckedTransactionsRpc(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TransactionRow[]> {
    const { data, error } = await supabase.rpc('check_unchecked_transactions', {
      p_budget_line_id: id,
    });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        undefined,
        {
          operation: 'checkTransactions',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }
}
