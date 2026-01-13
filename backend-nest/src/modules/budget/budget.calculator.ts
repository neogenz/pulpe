import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import { ZodError } from 'zod';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BudgetFormulas } from 'pulpe-shared';
import { BudgetRepository } from './budget.repository';
import { validateBudgetWithRolloverResponse } from './schemas/rpc-responses.schema';

/**
 * Handles all financial calculations for budgets
 */
@Injectable()
export class BudgetCalculator {
  constructor(
    @InjectPinoLogger(BudgetCalculator.name)
    private readonly logger: PinoLogger,
    private readonly repository: BudgetRepository,
  ) {}

  /**
   * Calculates the ending balance for a specific month
   * Uses shared BudgetFormulas with envelope-aware expense calculation
   * @param budgetId - The budget ID
   * @param supabase - Authenticated Supabase client
   * @returns The calculated ending balance
   */
  async calculateEndingBalance(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { budgetLines, transactions } = await this.repository.fetchBudgetData(
      budgetId,
      supabase,
      { selectFields: 'id, kind, amount, budget_line_id' },
    );

    // Map snake_case budget_line_id to camelCase budgetLineId for shared calculation
    const mappedTransactions = transactions.map((tx) => ({
      ...tx,
      budgetLineId: tx.budget_line_id,
    }));

    const totalIncome = BudgetFormulas.calculateTotalIncome(
      budgetLines,
      transactions,
    );
    const totalExpenses = BudgetFormulas.calculateTotalExpensesWithEnvelopes(
      budgetLines,
      mappedTransactions,
    );

    return totalIncome - totalExpenses;
  }

  /**
   * Recalculates and persists the ending balance
   * @param budgetId - The budget ID that was modified
   * @param supabase - Authenticated Supabase client
   */
  async recalculateAndPersist(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const endingBalance = await this.calculateEndingBalance(budgetId, supabase);
    await this.persistEndingBalance(budgetId, endingBalance, supabase);
  }

  /**
   * Gets rollover amount and previous budget ID from previous months
   * @param budgetId - Budget ID to get rollover for
   * @param payDayOfMonth - Day of month when pay period starts (1-31)
   * @param supabase - Authenticated Supabase client
   * @returns Rollover amount and previous budget ID from previous months
   */
  async getRollover(
    budgetId: string,
    payDayOfMonth: number,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_budget_with_rollover', {
          p_budget_id: budgetId,
          p_pay_day_of_month: payDayOfMonth,
        })
        .single();

      if (error) {
        this.handleRolloverFetchError(error, budgetId);
      }

      if (!data) {
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
          id: budgetId,
        });
      }

      const rolloverData = validateBudgetWithRolloverResponse(data);
      return {
        rollover: rolloverData.rollover,
        previousBudgetId: rolloverData.previous_budget_id,
      };
    } catch (error) {
      this.handleRolloverError(error, budgetId);
    }
  }

  private handleRolloverFetchError(error: unknown, budgetId: string): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
      { budgetId },
      {
        operation: 'getBudgetRollover',
        entityId: budgetId,
        entityType: 'budget',
        supabaseError: error,
      },
      { cause: error },
    );
  }

  private handleRolloverError(error: unknown, budgetId: string): never {
    if (error instanceof ZodError) {
      this.logger.error(
        {
          budgetId,
          validationErrors: error.issues,
          operation: 'getBudgetRollover.validation',
        },
        'RPC response validation failed for get_budget_with_rollover',
      );

      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        { budgetId },
        {
          operation: 'getBudgetRollover',
          entityId: budgetId,
          entityType: 'budget',
          validationErrors: error.issues,
        },
      );
    }

    handleServiceError(
      error,
      ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
      undefined,
      {
        operation: 'getBudgetRollover',
        entityId: budgetId,
        entityType: 'budget',
      },
    );
  }

  /**
   * Persists the calculated ending balance to the database
   * @param budgetId - Budget ID
   * @param endingBalance - Calculated ending balance
   * @param supabase - Authenticated Supabase client
   */
  private async persistEndingBalance(
    budgetId: string,
    endingBalance: number,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase
      .from('monthly_budget')
      .update({
        ending_balance: endingBalance,
      })
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

    this.logger.info(
      {
        budgetId,
        endingBalance,
        operation: 'balance.recalculated',
      },
      'Balance de fin de mois recalculée et persistée',
    );
  }
}
