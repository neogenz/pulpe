import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import {
  type BudgetUpdate,
  type TransactionKind,
  BudgetFormulas,
} from 'pulpe-shared';
import type { Tables } from '../../types/database.types';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Query result interface for typed results
 */
interface QueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  name?: string;
}

/**
 * Options for fetching budget data
 */
interface BudgetDataOptions {
  /** Fields to select from budget_line table (default: 'kind, amount') */
  budgetLineFields?: string;
  /** Fields to select from transaction table (default: 'kind, amount') */
  transactionFields?: string;
  includeBudget?: boolean;
  orderTransactions?: boolean;
}

/**
 * Result structure for budget data
 */
interface BudgetDataResult {
  budget?: Tables<'monthly_budget'>;
  budgetLines: Tables<'budget_line'>[];
  transactions: Tables<'transaction'>[];
}

/**
 * Aggregated totals for a budget
 */
export interface BudgetAggregates {
  totalExpenses: number;
  totalSavings: number;
  totalIncome: number;
}

/**
 * Handles all data access operations for budgets
 */
@Injectable()
export class BudgetRepository {
  constructor(
    @InjectInfoLogger(BudgetRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  /**
   * Fetches a single budget by ID
   * @param id - Budget ID
   * @param user - Authenticated user
   * @param supabase - Authenticated Supabase client
   * @returns Budget data
   */
  async fetchBudgetById(
    id: string,
    user: AuthenticatedUser,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'monthly_budget'>> {
    const { data: budgetDb, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !budgetDb) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'getBudget',
          userId: user.id,
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
      );
    }

    return budgetDb;
  }

  /**
   * Updates a budget in the database
   * @param id - Budget ID
   * @param updateData - Data to update
   * @param supabase - Authenticated Supabase client
   * @returns Updated budget data
   */
  async updateBudgetInDb(
    id: string,
    updateData: BudgetUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'monthly_budget'>> {
    const { data: budgetDb, error } = await supabase
      .from('monthly_budget')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error || !budgetDb) {
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

    return budgetDb;
  }

  /**
   * Checks if a budget already exists for a given month/year
   */
  async hasBudgetForPeriod(
    supabase: AuthenticatedSupabaseClient,
    userId: string,
    month: number,
    year: number,
  ): Promise<boolean> {
    const { data: existingBudget, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('user_id', userId)
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'hasBudgetForPeriod',
          entityType: 'budget',
        },
        { cause: error },
      );
    }

    return existingBudget !== null;
  }

  /**
   * Returns existing budget periods from a list of target months (batch query).
   * Avoids N+1 by checking all months in a single query.
   */
  async getExistingPeriods(
    supabase: AuthenticatedSupabaseClient,
    userId: string,
    targetMonths: { month: number; year: number }[],
  ): Promise<Set<string>> {
    if (targetMonths.length === 0) {
      return new Set();
    }

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

  /**
   * Fetches budget data with configurable options
   * @param budgetId - Budget ID
   * @param supabase - Authenticated Supabase client
   * @param options - Configuration options
   * @returns Budget data including lines and transactions
   */
  async fetchBudgetData(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    options: BudgetDataOptions = {},
  ): Promise<BudgetDataResult> {
    const {
      budgetLineFields = 'kind, amount',
      transactionFields = 'kind, amount',
      includeBudget = false,
      orderTransactions = false,
    } = options;

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

  /**
   * Builds the queries for fetching budget data
   * @param budgetId - Budget ID
   * @param supabase - Authenticated Supabase client
   * @param budgetLineFields - Fields to select from budget_line
   * @param transactionFields - Fields to select from transaction
   * @param orderTransactions - Whether to order transactions
   * @param includeBudget - Whether to include budget data
   * @returns Array of query promises
   */
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

  /**
   * Validates the results from the fetch queries
   * @param results - Query results
   * @param budgetId - Budget ID
   * @param includeBudget - Whether budget was included
   */
  private validateQueryResults(
    results: Array<QueryResult<unknown>>,
    budgetId: string,
    includeBudget: boolean,
  ): void {
    results.forEach((result: QueryResult<unknown>) => {
      if (result.error) {
        // Special handling for budget errors
        if (result.name === 'budget' && includeBudget) {
          throw new BusinessException(
            ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
            { id: budgetId },
            {
              operation: `fetch${result.name}`,
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
    });
  }

  /**
   * Processes the fetch results into the expected format
   * @param results - Query results
   * @param includeBudget - Whether budget was included
   * @returns Processed results
   */
  private processFetchResults(
    results: Array<QueryResult<unknown>>,
    includeBudget: boolean,
  ): BudgetDataResult {
    const budgetLinesResult = results.find((r) => r.name === 'budgetLines');
    const transactionsResult = results.find((r) => r.name === 'transactions');

    const response: BudgetDataResult = {
      budgetLines: Array.isArray(budgetLinesResult?.data)
        ? budgetLinesResult.data
        : [],
      transactions: Array.isArray(transactionsResult?.data)
        ? transactionsResult.data
        : [],
    };

    if (includeBudget) {
      response.budget = results.find((r) => r.name === 'budget')
        ?.data as Tables<'monthly_budget'>;
    }

    return response;
  }

  /**
   * Fetches aggregated totals for multiple budgets in batch using envelope logic.
   *
   * Envelope rule: for each budget line, use max(line.amount, sum_of_allocated_transactions).
   * Free transactions (no budget_line_id) are added separately.
   * This prevents double-counting when transactions are allocated to budget lines.
   *
   * totalExpenses includes both expense and saving kinds (per SPECS).
   * totalSavings uses envelope logic + free saving transactions.
   */
  async fetchBudgetAggregates(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
    decryptFn: (amount: string | null) => number = () => 0,
  ): Promise<Map<string, BudgetAggregates>> {
    const aggregatesMap = new Map<string, BudgetAggregates>();

    if (budgetIds.length === 0) {
      return aggregatesMap;
    }

    for (const budgetId of budgetIds) {
      aggregatesMap.set(budgetId, {
        totalExpenses: 0,
        totalSavings: 0,
        totalIncome: 0,
      });
    }

    try {
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
