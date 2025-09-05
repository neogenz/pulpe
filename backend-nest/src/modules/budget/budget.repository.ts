import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetUpdate } from '@pulpe/shared';
import type { Tables } from '../../types/database.types';

/**
 * Query result interface for typed results
 */
interface QueryResult<T> {
  data: T | null;
  error: unknown;
  name?: string;
}

/**
 * Options for fetching budget data
 */
interface BudgetDataOptions {
  selectFields?: string;
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
 * Handles all data access operations for budgets
 */
@Injectable()
export class BudgetRepository {
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
      selectFields = 'kind, amount',
      includeBudget = false,
      orderTransactions = false,
    } = options;

    const queries = this.buildFetchQueries(
      budgetId,
      supabase,
      selectFields,
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
   * @param selectFields - Fields to select
   * @param orderTransactions - Whether to order transactions
   * @param includeBudget - Whether to include budget data
   * @returns Array of query promises
   */
  private buildFetchQueries(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    selectFields: string,
    orderTransactions: boolean,
    includeBudget: boolean,
  ): Array<PromiseLike<QueryResult<unknown>>> {
    const queries = [
      this.createBudgetLineQuery(budgetId, supabase, selectFields),
      this.createTransactionQuery(
        budgetId,
        supabase,
        selectFields,
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
    selectFields: string,
    orderTransactions: boolean,
  ): PromiseLike<QueryResult<unknown>> {
    let query = supabase
      .from('transaction')
      .select(selectFields)
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
    selectFields: string,
  ): PromiseLike<QueryResult<unknown>> {
    let query = supabase
      .from('budget_line')
      .select(selectFields)
      .eq('budget_id', budgetId);

    if (selectFields === '*') {
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
}
