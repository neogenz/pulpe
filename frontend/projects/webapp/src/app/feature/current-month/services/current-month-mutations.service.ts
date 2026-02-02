import { inject, Injectable } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import { BudgetApi } from '@core/budget';
import { BudgetCache } from '@core/budget/budget-cache';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { TransactionApi } from '@core/transaction';
import {
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
} from 'pulpe-shared';
import { mergeToggleStates } from '@core/state/updaters/toggle-updaters';

import { type DashboardData } from './current-month-state';

export interface CurrentMonthMutationContext {
  readonly resource: {
    value(): DashboardData | undefined;
    isLoading(): boolean;
    set(data: DashboardData): void;
    reload(): void;
  };
}

@Injectable()
export class CurrentMonthMutationsService {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCache = inject(BudgetCache);
  readonly #transactionApi = inject(TransactionApi);
  readonly #invalidationService = inject(BudgetInvalidationService);

  async addTransaction(
    transactionData: TransactionCreate,
    ctx: CurrentMonthMutationContext,
  ): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      ctx,
      () => this.#transactionApi.create$(transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: [...currentData.transactions, response],
      }),
    );
  }

  async deleteTransaction(
    transactionId: string,
    ctx: CurrentMonthMutationContext,
  ): Promise<void> {
    return this.#performOptimisticMutation(
      ctx,
      () => this.#transactionApi.remove$(transactionId),
      (currentData) => ({
        ...currentData,
        transactions: currentData.transactions.filter(
          (t: Transaction) => t.id !== transactionId,
        ),
      }),
    );
  }

  async updateTransaction(
    transactionId: string,
    transactionData: TransactionUpdate,
    ctx: CurrentMonthMutationContext,
  ): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      ctx,
      () => this.#transactionApi.update$(transactionId, transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: currentData.transactions.map((t: Transaction) =>
          t.id === transactionId ? response : t,
        ),
      }),
    );
  }

  // Mutation pattern: merges concurrent toggle states to prevent data loss.
  // Fetches server-computed budget after mutation for authoritative values.
  async #performOptimisticMutation<T>(
    ctx: CurrentMonthMutationContext,
    operation: () => Observable<{ data: T }>,
    updateData: (currentData: DashboardData, response: T) => DashboardData,
  ): Promise<void>;
  async #performOptimisticMutation(
    ctx: CurrentMonthMutationContext,
    operation: () => Observable<void>,
    updateData: (currentData: DashboardData) => DashboardData,
  ): Promise<void>;
  async #performOptimisticMutation<T>(
    ctx: CurrentMonthMutationContext,
    operation: () => Observable<{ data: T } | void>,
    updateData: (currentData: DashboardData, response?: T) => DashboardData,
  ): Promise<void> {
    const originalData = ctx.resource.value();

    try {
      const response = await firstValueFrom(operation());

      const currentData = ctx.resource.value();
      if (!currentData?.budget) return;

      const responseData =
        response && typeof response === 'object' && 'data' in response
          ? (response as { data: T }).data
          : undefined;
      const updatedData = updateData(currentData, responseData);

      const serverBudget = await firstValueFrom(
        this.#budgetApi.getBudgetById$(currentData.budget.id),
      );

      const latestData = ctx.resource.value();
      if (!latestData?.budget) return;

      ctx.resource.set({
        ...updatedData,
        budgetLines:
          updatedData.budgetLines && latestData.budgetLines
            ? mergeToggleStates(updatedData.budgetLines, latestData.budgetLines)
            : updatedData.budgetLines,
        transactions:
          updatedData.transactions && latestData.transactions
            ? mergeToggleStates(
                updatedData.transactions,
                latestData.transactions,
              )
            : updatedData.transactions,
        budget: {
          ...(serverBudget ?? latestData.budget),
          rollover: latestData.budget.rollover,
          previousBudgetId: latestData.budget.previousBudgetId,
        },
      });

      this.#invalidateCache(latestData);
    } catch (error) {
      if (originalData) {
        ctx.resource.set(originalData);
      } else if (!ctx.resource.isLoading()) {
        ctx.resource.reload();
      }
      throw error;
    }
  }

  #invalidateCache(data: DashboardData): void {
    const budgetId = data.budget?.id;
    if (budgetId) {
      this.#budgetCache.invalidateBudgetDetails(budgetId);
    }
    this.#invalidationService.invalidate();
  }
}
