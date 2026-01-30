import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { handleServiceError } from '@common/utils/error-handler';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { BudgetFormulas } from 'pulpe-shared';
import { BudgetRepository } from './budget.repository';
import { EncryptionService } from '@modules/encryption/encryption.service';

/**
 * Handles all financial calculations for budgets
 */
@Injectable()
export class BudgetCalculator {
  constructor(
    @InjectInfoLogger(BudgetCalculator.name)
    private readonly logger: InfoLogger,
    private readonly repository: BudgetRepository,
    private readonly encryptionService: EncryptionService,
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
      {
        budgetLineFields: 'id, kind, amount',
        transactionFields: 'id, kind, amount, budget_line_id',
      },
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
   * @param clientKey - Client encryption key for DEK operations (null to skip encryption, e.g. demo mode)
   */
  async recalculateAndPersist(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer | null,
  ): Promise<void> {
    const endingBalance = await this.calculateEndingBalance(budgetId, supabase);
    await this.persistEndingBalance(
      budgetId,
      endingBalance,
      supabase,
      clientKey,
    );
  }

  /**
   * Gets rollover amount and previous budget ID from previous months
   * @param budgetId - Budget ID to get rollover for
   * @param payDayOfMonth - Day of month when pay period starts (1-31)
   * @param supabase - Authenticated Supabase client
   * @param clientKey - Client encryption key for DEK operations
   * @returns Rollover amount and previous budget ID from previous months
   */
  async getRollover(
    budgetId: string,
    payDayOfMonth: number,
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer,
  ): Promise<{ rollover: number; previousBudgetId: string | null }> {
    try {
      const userId = await this.#fetchBudgetUserId(budgetId, supabase);
      const budgetsForFormula = await this.#fetchAndDecryptBudgets(
        userId,
        budgetId,
        supabase,
        clientKey,
      );

      if (!budgetsForFormula.length) {
        return { rollover: 0, previousBudgetId: null };
      }

      const result = BudgetFormulas.calculateRollover(
        budgetsForFormula,
        budgetId,
        payDayOfMonth,
      );

      return {
        rollover: result.rollover,
        previousBudgetId: result.previousBudgetId,
      };
    } catch (error) {
      if (error instanceof BusinessException) throw error;

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

  async #fetchAndDecryptBudgets(
    userId: string,
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer,
  ): Promise<
    { id: string; month: number; year: number; endingBalance: number | null }[]
  > {
    const { data: allBudgets, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year, ending_balance, ending_balance_encrypted')
      .eq('user_id', userId);

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

    if (!allBudgets?.length) return [];

    const hasEncryptedData = allBudgets.some((b) => b.ending_balance_encrypted);
    const dek = hasEncryptedData
      ? await this.encryptionService.getUserDEK(userId, clientKey)
      : null;

    return allBudgets.map((b) => ({
      id: b.id,
      month: b.month,
      year: b.year,
      endingBalance:
        b.ending_balance_encrypted && dek
          ? this.encryptionService.tryDecryptAmount(
              b.ending_balance_encrypted,
              dek,
              b.ending_balance ?? 0,
            )
          : b.ending_balance,
    }));
  }

  async #fetchBudgetUserId(
    budgetId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string> {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('user_id')
      .eq('id', budgetId)
      .single();

    if (error || !data?.user_id) {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, {
        id: budgetId,
      });
    }

    return data.user_id;
  }

  /**
   * Persists the calculated ending balance to the database
   * @param budgetId - Budget ID
   * @param endingBalance - Calculated ending balance
   * @param supabase - Authenticated Supabase client
   * @param clientKey - Client encryption key for DEK operations (null to skip encryption, e.g. demo mode)
   */
  private async persistEndingBalance(
    budgetId: string,
    endingBalance: number,
    supabase: AuthenticatedSupabaseClient,
    clientKey: Buffer | null,
  ): Promise<void> {
    let encryptedBalance: string | null = null;

    if (clientKey) {
      const userId = await this.#fetchBudgetUserId(budgetId, supabase);
      const dek = await this.encryptionService.ensureUserDEK(userId, clientKey);
      encryptedBalance = this.encryptionService.encryptAmount(
        endingBalance,
        dek,
      );
    }

    const { error } = await supabase
      .from('monthly_budget')
      .update({
        ending_balance: endingBalance,
        ending_balance_encrypted: encryptedBalance,
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
        operation: 'balance.recalculated',
      },
      'Balance de fin de mois recalculée et persistée',
    );
  }
}
