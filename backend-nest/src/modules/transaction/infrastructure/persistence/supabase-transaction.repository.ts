import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { TransactionRepositoryPort } from '../../domain/ports/transaction-repository.port';
import type {
  TransactionRow,
  TransactionInsert,
  TransactionUpdate,
} from '../../domain/transaction.entity';

@Injectable()
export class SupabaseTransactionRepository implements TransactionRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
  ) {}

  async findAll(): Promise<TransactionRow[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async findById(id: string): Promise<TransactionRow> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'getTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }

    return data;
  }

  async findByBudgetId(budgetId: string): Promise<TransactionRow[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudget',
          entityId: budgetId,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async findByBudgetLineId(budgetLineId: string): Promise<TransactionRow[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('budget_line_id', budgetLineId)
      .order('transaction_date', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudgetLine',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async insert(data: TransactionInsert): Promise<TransactionRow> {
    const supabase = this.supabaseProvider.client;
    const { data: row, error } = await supabase
      .from('transaction')
      .insert(data)
      .select()
      .single();

    if (error) {
      const loggingContext = {
        operation: 'createTransaction',
        entityType: 'transaction',
        supabaseError: error,
      };

      if (error.code === '23505') {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_ALREADY_EXISTS,
          { id: data.id },
          loggingContext,
          { cause: error },
        );
      }

      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        loggingContext,
        { cause: error },
      );
    }

    return row;
  }

  async update(
    id: string,
    data: Partial<TransactionUpdate>,
  ): Promise<TransactionRow> {
    const supabase = this.supabaseProvider.client;
    const { data: row, error } = await supabase
      .from('transaction')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'updateTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return row;
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('transaction').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'deleteTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }
  }

  async fetchBudgetIdForTransaction(id: string): Promise<string> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('transaction')
      .select('budget_id')
      .eq('id', id)
      .single();

    return data?.budget_id ?? '';
  }

  async fetchBudgetLineForAllocation(
    budgetLineId: string,
  ): Promise<{ id: string; budget_id: string; kind: string } | null> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id, budget_id, kind')
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }

  async assertBudgetLineExists(budgetLineId: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id')
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'assertBudgetLineExists',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }
  }

  async fetchBudgetIdsByYears(
    _userId: string,
    years: number[],
  ): Promise<string[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .in('year', years);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetIdsByYears',
          entityType: 'monthly_budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data?.map((b) => b.id) ?? [];
  }

  async fetchTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<
    {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      transaction_date: string;
      category: string | null;
      budget_id: string;
      budget: unknown;
    }[]
  > {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('transaction')
      .select(
        `
        id,
        name,
        amount,
        kind,
        transaction_date,
        category,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .or(`name.ilike.${searchPattern},category.ilike.${searchPattern}`);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchTransactionsByPattern',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      transaction_date: string;
      category: string | null;
      budget_id: string;
      budget: unknown;
    }[];
  }

  async fetchBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<
    {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      recurrence: 'fixed' | 'one_off';
      budget_id: string;
      budget: unknown;
    }[]
  > {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('budget_line')
      .select(
        `
        id,
        name,
        amount,
        kind,
        recurrence,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .ilike('name', searchPattern);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetLinesByPattern',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as {
      id: string;
      name: string;
      amount: string | null;
      kind: string;
      recurrence: 'fixed' | 'one_off';
      budget_id: string;
      budget: unknown;
    }[];
  }
}
