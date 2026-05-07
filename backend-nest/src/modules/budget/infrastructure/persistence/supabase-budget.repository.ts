import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BudgetFormulas, type TransactionKind } from 'pulpe-shared';
import type {
  BudgetRow,
  BudgetLineRow,
  TransactionRow,
} from '../../domain/budget.entity';
import type {
  BudgetRepositoryPort,
  BudgetDataOptions,
  BudgetDataResult,
} from '../../domain/ports/budget-repository.port';
import type { PostgrestError } from '@supabase/supabase-js';

export interface BudgetAggregates {
  totalExpenses: number;
  totalSavings: number;
  totalIncome: number;
}

interface QueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  name?: string;
}

@Injectable()
export class SupabaseBudgetRepository implements BudgetRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @InjectInfoLogger(SupabaseBudgetRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  async hasAnyBudget(): Promise<boolean> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'hasBudgets',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data !== null;
  }

  async fetchAllBudgets(): Promise<BudgetRow[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgets',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async fetchBudgetsWithFilters(filters: {
    limit?: number;
    year?: number;
  }): Promise<BudgetRow[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.year) query = query.eq('year', filters.year);

    const { data, error } = await query;

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetsSparse',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async fetchAllBudgetsForExport(): Promise<BudgetRow[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'exportAllBudgets',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async fetchBudgetById(id: string, userId: string): Promise<BudgetRow> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'getBudget',
          userId,
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
      );
    }

    return data;
  }

  async fetchBudgetUserId(id: string): Promise<string> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('user_id')
      .eq('id', id)
      .single();

    if (error || !data?.user_id) {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, { id });
    }

    return data.user_id;
  }

  async validateBudgetExists(id: string): Promise<BudgetRow> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'getBudgetWithDetails',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
      );
    }

    return data;
  }

  async updateBudget(
    id: string,
    updateData: Record<string, unknown>,
  ): Promise<BudgetRow> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'updateBudgetInDb',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data;
  }

  async deleteBudget(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'deleteBudget',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  async deleteBudgetsByIds(ids: string[]): Promise<boolean> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .in('id', ids);
    return !error;
  }

  async getExistingPeriods(
    userId: string,
    targetMonths: { month: number; year: number }[],
  ): Promise<Set<string>> {
    if (targetMonths.length === 0) return new Set();

    const supabase = this.supabaseProvider.client;
    const periodFilters = targetMonths
      .map((t) => `and(month.eq.${t.month},year.eq.${t.year})`)
      .join(',');

    const { data, error } = await supabase
      .from('monthly_budget')
      .select('month, year')
      .eq('user_id', userId)
      .or(periodFilters);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'getExistingPeriods',
          entityType: 'budget',
        },
        { cause: error },
      );
    }

    return new Set(
      (data ?? []).map(
        (row: { month: number; year: number }) => `${row.month}/${row.year}`,
      ),
    );
  }

  async fetchBudgetData(
    budgetId: string,
    options: BudgetDataOptions = {},
  ): Promise<BudgetDataResult> {
    const {
      budgetLineFields = 'kind, amount',
      transactionFields = 'kind, amount',
      includeBudget = false,
      orderTransactions = false,
    } = options;

    const supabase = this.supabaseProvider.client;
    const queries = this.buildFetchQueries(
      budgetId,
      supabase,
      budgetLineFields,
      transactionFields,
      orderTransactions,
      includeBudget,
    );

    const results = await Promise.all(queries);
    this.validateQueryResults(results, budgetId, includeBudget);

    return this.processFetchResults(results, includeBudget);
  }

  async createBudgetFromTemplateRpc(payload: {
    p_user_id: string;
    p_template_id: string;
    p_month: number;
    p_year: number;
    p_description: string;
  }): Promise<unknown> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase.rpc(
      'create_budget_from_template',
      payload,
    );

    if (error) {
      throw error;
    }

    return data;
  }

  async persistEndingBalance(
    budgetId: string,
    encryptedBalance: string,
  ): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('monthly_budget')
      .update({ ending_balance: encryptedBalance })
      .eq('id', budgetId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_UPDATE_FAILED,
        { budgetId },
        {
          operation: 'persistEndingBalance',
          entityId: budgetId,
          entityType: 'monthly_budget',
        },
        { cause: error },
      );
    }
  }

  async fetchAllBudgetsForRollover(
    userId: string,
  ): Promise<
    { id: string; month: number; year: number; ending_balance: string | null }[]
  > {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year, ending_balance')
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchAllBudgetsForRollover',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async fetchBudgetAggregates(
    budgetIds: string[],
    decryptFn: (amount: string | null) => number,
  ): Promise<Map<string, BudgetAggregates>> {
    const aggregatesMap = new Map<string, BudgetAggregates>();

    if (budgetIds.length === 0) return aggregatesMap;

    for (const budgetId of budgetIds) {
      aggregatesMap.set(budgetId, {
        totalExpenses: 0,
        totalSavings: 0,
        totalIncome: 0,
      });
    }

    try {
      const supabase = this.supabaseProvider.client;
      const [budgetLinesResult, transactionsResult] = await Promise.all([
        supabase
          .from('budget_line')
          .select('id, budget_id, kind, amount')
          .in('budget_id', budgetIds),
        supabase
          .from('transaction')
          .select('budget_id, kind, amount, budget_line_id')
          .in('budget_id', budgetIds),
      ]);

      this.computeEnvelopeAggregates(
        budgetLinesResult.data ?? [],
        transactionsResult.data ?? [],
        aggregatesMap,
        decryptFn,
      );
    } catch (error) {
      this.logger.warn('Failed to fetch budget aggregates, returning zeros', {
        budgetIds,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return aggregatesMap;
  }

  private computeEnvelopeAggregates(
    budgetLines: Array<{
      id: string;
      budget_id: string;
      kind: TransactionKind;
      amount: string | null;
    }>,
    transactions: Array<{
      budget_id: string;
      kind: TransactionKind;
      amount: string | null;
      budget_line_id: string | null;
    }>,
    aggregatesMap: Map<string, BudgetAggregates>,
    decryptFn: (amount: string | null) => number,
  ): void {
    const linesByBudget = this.groupByBudgetId(budgetLines);
    const txsByBudget = this.groupByBudgetId(transactions);

    for (const [budgetId, aggregates] of aggregatesMap) {
      const lines = (linesByBudget.get(budgetId) ?? []).map((l) => ({
        id: l.id,
        kind: l.kind,
        amount: decryptFn(l.amount),
      }));

      const txs = (txsByBudget.get(budgetId) ?? []).map((t) => ({
        kind: t.kind,
        amount: decryptFn(t.amount),
        budgetLineId: t.budget_line_id,
      }));

      const metrics = BudgetFormulas.calculateAllMetrics(lines, txs);
      aggregates.totalExpenses = metrics.totalExpenses;
      aggregates.totalIncome = metrics.totalIncome;
      aggregates.totalSavings = metrics.totalSavings;
    }
  }

  private buildFetchQueries(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    budgetLineFields: string,
    transactionFields: string,
    orderTransactions: boolean,
    includeBudget: boolean,
  ): Array<PromiseLike<QueryResult<unknown>>> {
    const queries = [
      this.createBudgetLineQuery(budgetId, supabase, budgetLineFields),
      this.createTransactionQuery(
        budgetId,
        supabase,
        transactionFields,
        orderTransactions,
      ),
    ];

    if (includeBudget) {
      queries.push(this.createBudgetQuery(budgetId, supabase));
    }

    return queries;
  }

  private createBudgetLineQuery(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    budgetLineFields: string,
  ): PromiseLike<QueryResult<unknown>> {
    let query = supabase
      .from('budget_line')
      .select(budgetLineFields)
      .eq('budget_id', budgetId);

    if (budgetLineFields === '*') {
      query = query.order('created_at', { ascending: false });
    }

    return query.then((result) => ({
      name: 'budgetLines',
      data: result.data,
      error: result.error,
    }));
  }

  private createTransactionQuery(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    transactionFields: string,
    orderTransactions: boolean,
  ): PromiseLike<QueryResult<unknown>> {
    let query = supabase
      .from('transaction')
      .select(transactionFields)
      .eq('budget_id', budgetId);

    if (orderTransactions) {
      query = query.order('transaction_date', { ascending: false });
    }

    return query.then((result) => ({
      name: 'transactions',
      data: result.data,
      error: result.error,
    }));
  }

  private createBudgetQuery(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): PromiseLike<QueryResult<unknown>> {
    return supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', budgetId)
      .single()
      .then((result) => ({
        name: 'budget',
        data: result.data,
        error: result.error,
      }));
  }

  private validateQueryResults(
    results: Array<QueryResult<unknown>>,
    budgetId: string,
    includeBudget: boolean,
  ): void {
    for (const result of results) {
      if (!result.error) continue;

      if (result.name === 'budget' && includeBudget) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
          { id: budgetId },
          {
            operation: `fetchBudget`,
            entityId: budgetId,
            entityType: result.name,
          },
          { cause: result.error },
        );
      }

      throw new BusinessException(
        result.name === 'budgetLines'
          ? ERROR_DEFINITIONS.BUDGET_FETCH_FAILED
          : ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        { budgetId },
        {
          operation: `fetch${result.name}`,
          entityId: budgetId,
          entityType: result.name,
        },
        { cause: result.error },
      );
    }
  }

  private processFetchResults(
    results: Array<QueryResult<unknown>>,
    includeBudget: boolean,
  ): BudgetDataResult {
    const budgetLinesResult = results.find((r) => r.name === 'budgetLines');
    const transactionsResult = results.find((r) => r.name === 'transactions');

    const response: BudgetDataResult = {
      budgetLines: Array.isArray(budgetLinesResult?.data)
        ? (budgetLinesResult.data as BudgetLineRow[])
        : [],
      transactions: Array.isArray(transactionsResult?.data)
        ? (transactionsResult.data as TransactionRow[])
        : [],
    };

    if (includeBudget) {
      response.budget = results.find((r) => r.name === 'budget')
        ?.data as BudgetRow;
    }

    return response;
  }

  private groupByBudgetId<T extends { budget_id: string }>(
    items: T[],
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      if (!map.has(item.budget_id)) map.set(item.budget_id, []);
      map.get(item.budget_id)!.push(item);
    }
    return map;
  }
}
