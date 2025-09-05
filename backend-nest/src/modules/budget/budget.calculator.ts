import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetLine } from '@pulpe/shared';
import { BUDGET_CONSTANTS, type MonthRange } from './budget.constants';
import { BudgetRepository } from './budget.repository';

/**
 * Response interface for the get_budget_with_rollover RPC function
 */
interface BudgetWithRolloverResponse {
  ending_balance: number;
  rollover: number;
  available_to_spend: number;
  previous_budget_id: string | null;
}

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
      { selectFields: 'kind, amount' },
    );

    const allMonthlyItems = [...budgetLines, ...transactions];
    const { totalMonthlyIncome, totalMonthlyExpenses } = allMonthlyItems.reduce(
      (acc, item) => {
        if (item.kind === 'income') {
          acc.totalMonthlyIncome += item.amount;
        } else {
          acc.totalMonthlyExpenses += item.amount;
        }
        return acc;
      },
      { totalMonthlyIncome: 0, totalMonthlyExpenses: 0 },
    );

    return totalMonthlyIncome - totalMonthlyExpenses;
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
   * @param supabase - Authenticated Supabase client
   * @returns Rollover amount and previous budget ID from previous months
   */
  async getRollover(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    try {
      const { data, error } = await supabase
        .rpc('get_budget_with_rollover', { p_budget_id: budgetId })
        .single();

      if (error) {
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

      if (!data) {
        throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
          id: budgetId,
        });
      }

      const rolloverData = data as BudgetWithRolloverResponse;
      return {
        rollover: rolloverData.rollover ?? 0,
        previousBudgetId: rolloverData.previous_budget_id ?? null,
      };
    } catch (error) {
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
  }

  /**
   * Builds a rollover line from pre-calculated data
   * @param budget - Current budget
   * @param rolloverAmount - Rollover amount (already calculated by RPC)
   * @param previousBudgetId - ID of the previous budget where rollover comes from
   * @returns BudgetLine for rollover
   */
  buildRolloverLine(
    budget: {
      id: string;
      month: number;
      year: number;
      createdAt: string;
      updatedAt: string;
    },
    rolloverAmount: number,
    previousBudgetId: string | null,
  ): BudgetLine {
    const { month: prevMonth, year: prevYear } =
      budget.month === 1
        ? { month: 12, year: budget.year - 1 }
        : { month: budget.month - 1, year: budget.year };

    return {
      id: BUDGET_CONSTANTS.ROLLOVER.formatId(budget.id),
      budgetId: budget.id,
      templateLineId: null,
      savingsGoalId: null,
      name: BUDGET_CONSTANTS.ROLLOVER.formatName(
        prevMonth as MonthRange,
        prevYear,
      ),
      amount: Math.abs(rolloverAmount),
      kind: rolloverAmount > 0 ? 'income' : 'expense',
      recurrence: 'one_off',
      isManuallyAdjusted: false,
      isRollover: true,
      rolloverSourceBudgetId: previousBudgetId,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
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
