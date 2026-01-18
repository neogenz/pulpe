import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { BudgetApi } from '@core/budget';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { TransactionApi } from '@core/transaction';
import { UserSettingsApi } from '@core/user-settings';
import { createRolloverLine } from '@core/rollover/rollover-types';
import {
  type BudgetLine,
  type Transaction,
  type TransactionCreate,
  type TransactionUpdate,
  BudgetFormulas,
  getBudgetPeriodForDate,
} from 'pulpe-shared';
import { firstValueFrom, map, of, switchMap, type Observable } from 'rxjs';
import {
  type CurrentMonthState,
  type DashboardData,
} from './current-month-state';
import { createInitialCurrentMonthInternalState } from './current-month-state';

/**
 * CurrentMonthStore - Signal-based state management for current month dashboard
 *
 * This store manages the current month's financial data including:
 * - Budget information and lines
 * - Transactions
 * - Loading and error states
 * - Calculated financial metrics
 *
 * Architecture:
 * - Uses Angular's rxResource() API for async data loading with RxJS integration
 * - Automatic request cancellation when parameters change
 * - Simplified state management without complex optimistic updates
 * - Relies on resource reload for data consistency after mutations
 */
@Injectable()
export class CurrentMonthStore {
  #budgetApi = inject(BudgetApi);
  #transactionApi = inject(TransactionApi);
  #httpClient = inject(HttpClient);
  #appConfig = inject(ApplicationConfiguration);
  #userSettingsApi = inject(UserSettingsApi);
  #invalidationService = inject(BudgetInvalidationService);

  /**
   * Simple state signal for UI feedback during operations
   */
  readonly #state = signal<CurrentMonthState>(
    createInitialCurrentMonthInternalState(),
  );

  /**
   * Pay day of month from user settings
   * Used to calculate the correct budget period
   */
  readonly payDayOfMonth = this.#userSettingsApi.payDayOfMonth;

  /**
   * Current budget period computed using payDayOfMonth
   * This determines which month/year to load based on user's pay cycle
   */
  readonly currentBudgetPeriod = computed(() => {
    const currentDate = this.#state().currentDate;
    const payDay = this.payDayOfMonth();
    return getBudgetPeriodForDate(currentDate, payDay);
  });

  /**
   * Resource for loading dashboard data - single source of truth for async data.
   * Includes invalidation version to auto-reload when budgets are mutated.
   * Uses rxResource for automatic request cancellation and RxJS integration.
   */
  readonly #dashboardResource = rxResource<
    DashboardData,
    { month: string; year: string; version: number }
  >({
    params: () => {
      const period = this.currentBudgetPeriod();
      return {
        month: period.month.toString().padStart(2, '0'),
        year: period.year.toString(),
        version: this.#invalidationService.version(),
      };
    },
    stream: ({ params }) => this.#loadDashboardData$(params),
  });

  /**
   * Dashboard data selector
   */
  readonly dashboardData = computed(() => this.#dashboardResource.value());

  readonly transactions = computed<Transaction[]>(
    () => this.dashboardData()?.transactions || [],
  );

  /**
   * Budget lines selector - raw data from API
   */
  readonly budgetLines = computed<BudgetLine[]>(
    () => this.dashboardData()?.budgetLines || [],
  );

  /**
   * Budget lines for display - includes virtual rollover line when applicable
   * Transforms rollover from Budget into a display line for UI consistency
   */
  readonly displayBudgetLines = computed<BudgetLine[]>(() => {
    const lines = [...this.budgetLines()];
    const rollover = this.rolloverAmount();
    const budget = this.dashboardData()?.budget;

    // Add virtual rollover line for display if rollover exists
    if (rollover !== 0 && budget) {
      const rolloverLine = createRolloverLine({
        budgetId: budget.id,
        amount: rollover,
        month: budget.month,
        year: budget.year,
        previousBudgetId: budget.previousBudgetId,
      });

      // Add rollover at the beginning of the list
      lines.unshift(rolloverLine);
    }

    return lines;
  });

  /**
   * Settings loading state - exposed to prevent data flash during initial load
   */
  readonly isSettingsLoading = computed(() =>
    this.#userSettingsApi.isLoading(),
  );

  /**
   * Standardized resource state signals (aligned with Angular resource() API)
   * isLoading includes settings loading to prevent flash of incorrect period data
   */
  readonly isLoading = computed(
    () => this.#dashboardResource.isLoading() || this.isSettingsLoading(),
  );
  readonly hasValue = computed(() => this.#dashboardResource.hasValue());
  readonly error = computed(() => this.#dashboardResource.error());
  readonly status = computed(() => this.#dashboardResource.status());

  /**
   * Initial loading state - determines when to show full-page spinner.
   *
   * Returns true only when:
   * - Dashboard resource is in initial 'loading' state (not 'reloading')
   * - OR settings are still loading and we have no cached data yet
   *
   * This enables "stale-while-revalidate": show cached data immediately
   * while refreshing in background (status === 'reloading').
   */
  readonly isInitialLoading = computed(
    () =>
      this.status() === 'loading' ||
      (this.isSettingsLoading() && !this.hasValue()),
  );

  /**
   * Current date selector
   */
  readonly budgetDate = computed(() => this.#state().currentDate);

  /**
   * Rollover amount depuis le Budget (plus de calcul depuis BudgetLines)
   */
  readonly rolloverAmount = computed<number>(() => {
    const budget = this.dashboardData()?.budget;
    return budget?.rollover || 0;
  });

  /**
   * Total des revenus (budget lines + transactions)
   */
  readonly totalIncome = computed<number>(() => {
    const budgetLines = this.budgetLines();
    const transactions = this.transactions();
    return BudgetFormulas.calculateTotalIncome(budgetLines, transactions);
  });

  /**
   * Total dépensé (expenses + savings) avec logique d'enveloppe
   *
   * Règle métier:
   * - Les transactions ALLOUÉES sont "couvertes" par leur enveloppe
   * - Seul le DÉPASSEMENT (consumed > envelope.amount) impacte le budget
   * - Les transactions LIBRES impactent directement le budget
   */
  readonly totalExpenses = computed<number>(() =>
    BudgetFormulas.calculateTotalExpensesWithEnvelopes(
      this.budgetLines(),
      this.transactions(),
    ),
  );

  /**
   * Montant total disponible = revenu + rollover (formule SPECS)
   */
  readonly totalAvailable = computed<number>(() => {
    const totalIncome = this.totalIncome();
    const rollover = this.rolloverAmount();
    return BudgetFormulas.calculateAvailable(totalIncome, rollover);
  });

  /**
   * Montant restant à dépenser (ending balance)
   */
  readonly remaining = computed<number>(() => {
    const available = this.totalAvailable();
    const expenses = this.totalExpenses();
    return BudgetFormulas.calculateRemaining(available, expenses);
  });

  /**
   * Refresh dashboard data by reloading the resource
   */
  refreshData(): void {
    if (!this.isLoading()) {
      this.#dashboardResource.reload();
    }
  }

  /**
   * Update the current date (triggers data reload)
   */
  setCurrentDate(date: Date): void {
    this.#state.update((state) => ({
      ...state,
      currentDate: new Date(date), // Ensure immutability
    }));
  }

  /**
   * Add a new transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async addTransaction(transactionData: TransactionCreate): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      () => this.#transactionApi.create$(transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: [...currentData.transactions, response],
      }),
    );
  }

  /**
   * Delete a transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async deleteTransaction(transactionId: string): Promise<void> {
    return this.#performOptimisticMutation(
      () => this.#transactionApi.remove$(transactionId),
      (currentData) => ({
        ...currentData,
        transactions: currentData.transactions.filter(
          (t: Transaction) => t.id !== transactionId,
        ),
      }),
    );
  }

  /**
   * Update a transaction
   * Uses optimistic update with local calculation + backend sync
   */
  async updateTransaction(
    transactionId: string,
    transactionData: TransactionUpdate,
  ): Promise<void> {
    return this.#performOptimisticMutation<Transaction>(
      () => this.#transactionApi.update$(transactionId, transactionData),
      (currentData, response) => ({
        ...currentData,
        transactions: currentData.transactions.map((t: Transaction) =>
          t.id === transactionId ? response : t,
        ),
      }),
    );
  }

  /**
   * Generic optimistic update pattern for mutations
   * Overloaded for operations returning data (create, update) and void operations (delete)
   */
  async #performOptimisticMutation<T>(
    operation: () => Observable<{ data: T }>,
    updateData: (currentData: DashboardData, response: T) => DashboardData,
  ): Promise<void>;
  async #performOptimisticMutation(
    operation: () => Observable<void>,
    updateData: (currentData: DashboardData) => DashboardData,
  ): Promise<void>;
  async #performOptimisticMutation<T>(
    operation: () => Observable<{ data: T } | void>,
    updateData: (currentData: DashboardData, response?: T) => DashboardData,
  ): Promise<void> {
    const originalData = this.#dashboardResource.value();

    try {
      // 1. Execute backend operation first
      const response = await firstValueFrom(operation());

      // 2. Apply optimistic update
      const currentData = this.#dashboardResource.value();
      if (currentData && currentData.budget) {
        // Extract response data if present (create/update), undefined for delete
        const responseData =
          response && typeof response === 'object' && 'data' in response
            ? response.data
            : undefined;
        const updatedData = updateData(currentData, responseData);

        // Recalculate ending balance locally (envelope-aware)
        const rollover = updatedData.budget?.rollover || 0;
        const metrics = BudgetFormulas.calculateAllMetricsWithEnvelopes(
          updatedData.budgetLines,
          updatedData.transactions,
          rollover,
        );

        // Apply optimistic update
        this.#dashboardResource.set({
          ...updatedData,
          budget: {
            ...currentData.budget,
            endingBalance: metrics.endingBalance,
          },
        });

        // 3. Sync with backend for accurate ending balance
        const budgetId = currentData.budget.id;
        const updatedBudget = await firstValueFrom(
          this.#budgetApi.getBudgetById$(budgetId),
        );

        // 4. Update with real backend value
        const latestData = this.#dashboardResource.value();
        if (latestData && latestData.budget && updatedBudget) {
          this.#dashboardResource.set({
            ...latestData,
            budget: {
              ...updatedBudget,
              rollover: latestData.budget.rollover,
              previousBudgetId: latestData.budget.previousBudgetId,
            },
          });
        }
      }
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.#dashboardResource.set(originalData);
      } else {
        this.refreshData();
      }
      throw error;
    }
  }

  /**
   * Toggle the checked state of a budget line
   * Uses optimistic update for instant UI feedback with rollback on error
   */
  async toggleBudgetLineCheck(budgetLineId: string): Promise<void> {
    const originalData = this.#dashboardResource.value();
    if (!originalData) return;

    const budgetLine = originalData.budgetLines.find(
      (line) => line.id === budgetLineId,
    );
    if (!budgetLine) return;

    const newCheckedAt =
      budgetLine.checkedAt === null ? new Date().toISOString() : null;

    this.#dashboardResource.set({
      ...originalData,
      budgetLines: originalData.budgetLines.map((line) =>
        line.id === budgetLineId ? { ...line, checkedAt: newCheckedAt } : line,
      ),
    });

    try {
      const apiUrl = `${this.#appConfig.backendApiUrl()}/budget-lines/${budgetLineId}/toggle-check`;
      await firstValueFrom(this.#httpClient.post(apiUrl, {}));
    } catch (error) {
      this.#dashboardResource.set(originalData);
      throw error;
    }
  }

  /**
   * Toggle the checked state of a transaction
   * Uses optimistic update for instant UI feedback with rollback on error
   */
  async toggleTransactionCheck(transactionId: string): Promise<void> {
    const originalData = this.#dashboardResource.value();
    if (!originalData) return;

    const transaction = originalData.transactions.find(
      (tx) => tx.id === transactionId,
    );
    if (!transaction) return;

    const newCheckedAt =
      transaction.checkedAt === null ? new Date().toISOString() : null;

    this.#dashboardResource.set({
      ...originalData,
      transactions: originalData.transactions.map((tx) =>
        tx.id === transactionId ? { ...tx, checkedAt: newCheckedAt } : tx,
      ),
    });

    try {
      await firstValueFrom(this.#transactionApi.toggleCheck$(transactionId));
    } catch (error) {
      this.#dashboardResource.set(originalData);
      throw error;
    }
  }

  /**
   * Load dashboard data from API as Observable
   * Chains two API calls: getBudgetForMonth → getBudgetWithDetails
   */
  #loadDashboardData$(params: {
    month: string;
    year: string;
  }): Observable<DashboardData> {
    return this.#budgetApi.getBudgetForMonth$(params.month, params.year).pipe(
      switchMap((budget) => {
        if (!budget) {
          return of({ budget: null, transactions: [], budgetLines: [] });
        }
        return this.#budgetApi.getBudgetWithDetails$(budget.id).pipe(
          map((response) => ({
            budget: response.data.budget,
            transactions: response.data.transactions,
            budgetLines: response.data.budgetLines,
          })),
        );
      }),
    );
  }
}
