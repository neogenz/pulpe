import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetCache } from '@core/budget/budget-cache';
import { createStaleFallback } from '@core/cache';
import { Logger } from '@core/logging/logger';
import { createRolloverLine } from '@core/rollover/rollover-types';
import { BudgetFormulas } from 'pulpe-shared';

import { type BudgetDetailsViewModel } from '../models/budget-details-view-model';

@Injectable()
export class BudgetDetailsStateService {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCache = inject(BudgetCache);
  readonly #logger = inject(Logger);

  readonly #budgetId = signal<string | null>(null);
  readonly #errorMessage = signal<string | null>(null);
  readonly #rolloverCheckedAt = signal<string | null>(null);

  // ─── Resource & SWR ────────────────────────────────────────────

  readonly resource = resource<BudgetDetailsViewModel, string | null>({
    params: () => this.#budgetId(),
    loader: async ({ params: budgetId }) => {
      if (!budgetId) {
        throw new Error('Budget ID is required');
      }

      // Skip stale cache hits to force fresh API call — see DR-009
      const cached = this.#budgetCache.getBudgetDetails(budgetId);
      if (cached && !this.#budgetCache.isBudgetDetailStale(budgetId)) {
        return {
          ...cached.budget,
          budgetLines: cached.budgetLines,
          transactions: cached.transactions,
        } satisfies BudgetDetailsViewModel;
      }

      const response = await firstValueFrom(
        this.#budgetApi.getBudgetWithDetails$(budgetId),
      );

      if (!response.success || !response.data) {
        this.#logger.error('Failed to fetch budget details', { budgetId });
        throw new Error('Failed to fetch budget details');
      }

      return {
        ...response.data.budget,
        budgetLines: response.data.budgetLines,
        transactions: response.data.transactions,
      };
    },
  });

  readonly #swr = createStaleFallback({ resource: this.resource });
  readonly budgetDetails = this.#swr.data;
  readonly isLoading = this.#swr.isLoading;
  readonly isInitialLoading = this.#swr.isInitialLoading;
  readonly hasValue = this.#swr.hasValue;
  readonly error = computed(
    () => this.resource.error() || this.#errorMessage(),
  );

  // ─── Selectors ─────────────────────────────────────────────────

  readonly displayBudgetLines = computed(() => {
    const details = this.budgetDetails();
    if (!details) return [];

    const lines = [...details.budgetLines];
    const rollover = details.rollover;

    if (rollover !== 0 && rollover !== undefined) {
      const rolloverLine = createRolloverLine({
        budgetId: details.id,
        amount: rollover,
        month: details.month,
        year: details.year,
        previousBudgetId: details.previousBudgetId,
      });
      rolloverLine.checkedAt = this.#rolloverCheckedAt();
      lines.unshift(rolloverLine);
    }

    return lines;
  });

  readonly realizedBalance = computed(() => {
    if (!this.resource.hasValue()) return 0;
    const details = this.resource.value()!;
    return BudgetFormulas.calculateRealizedBalance(
      this.displayBudgetLines(),
      details.transactions,
    );
  });

  readonly realizedExpenses = computed(() => {
    if (!this.resource.hasValue()) return 0;
    const details = this.resource.value()!;
    return BudgetFormulas.calculateRealizedExpenses(
      this.displayBudgetLines(),
      details.transactions,
    );
  });

  // ─── Public API ────────────────────────────────────────────────

  // Cache-first display: seed stale data before resource triggers — see DR-006
  setBudgetId(budgetId: string): void {
    const cached = this.#budgetCache.getBudgetDetails(budgetId);
    this.#swr.setStaleData(
      cached
        ? {
            ...cached.budget,
            budgetLines: cached.budgetLines,
            transactions: cached.transactions,
          }
        : null,
    );

    this.#budgetId.set(budgetId);
    this.#rolloverCheckedAt.set(new Date().toISOString());
  }

  setErrorMessage(message: string | null): void {
    this.#errorMessage.set(message);
  }

  setRolloverCheckedAt(value: string | null): void {
    this.#rolloverCheckedAt.set(value);
  }

  getRolloverCheckedAt(): string | null {
    return this.#rolloverCheckedAt();
  }

  reload(): void {
    this.resource.reload();
    this.#errorMessage.set(null);
  }
}
