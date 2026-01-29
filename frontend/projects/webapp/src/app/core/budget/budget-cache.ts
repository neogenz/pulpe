import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type Budget, type BudgetDetailsResponse } from 'pulpe-shared';
import { filter, firstValueFrom, first } from 'rxjs';
import { BudgetApi } from './budget-api';
import { Logger } from '../logging/logger';

interface BudgetDetailsEntry {
  readonly budget: Budget;
  readonly budgetLines: BudgetDetailsResponse['data']['budgetLines'];
  readonly transactions: BudgetDetailsResponse['data']['transactions'];
}

@Injectable({ providedIn: 'root' })
export class BudgetCache {
  readonly #budgetApi = inject(BudgetApi);
  readonly #logger = inject(Logger);

  readonly #budgets = signal<Budget[] | null>(null);
  readonly #budgetDetailsMap = signal<Map<string, BudgetDetailsEntry>>(
    new Map(),
  );
  readonly #isListLoading = signal(false);
  readonly #loadingDetailIds = signal<Set<string>>(new Set());

  readonly budgets = this.#budgets.asReadonly();
  readonly isListLoading = this.#isListLoading.asReadonly();
  readonly hasBudgets = computed(() => this.#budgets() !== null);

  getBudgetDetails(budgetId: string): BudgetDetailsEntry | null {
    return this.#budgetDetailsMap().get(budgetId) ?? null;
  }

  isBudgetDetailLoading(budgetId: string): boolean {
    return this.#loadingDetailIds().has(budgetId);
  }

  isBudgetDetailAvailable(budgetId: string): boolean {
    return this.#budgetDetailsMap().has(budgetId);
  }

  async waitForBudgetDetails(budgetId: string): Promise<BudgetDetailsEntry> {
    const cached = this.getBudgetDetails(budgetId);
    if (cached) return cached;

    // Wait for this specific budget detail to appear in the map
    const detailsMap$ = toObservable(this.#budgetDetailsMap);
    const map = await firstValueFrom(
      detailsMap$.pipe(
        filter((m) => m.has(budgetId)),
        first(),
      ),
    );
    return map.get(budgetId)!;
  }

  async preloadBudgetList(): Promise<Budget[]> {
    if (this.#isListLoading()) return this.#budgets() ?? [];

    this.#isListLoading.set(true);
    try {
      const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());
      this.#budgets.set(budgets);
      return budgets;
    } catch (error) {
      this.#logger.error('[BudgetCache] Failed to preload budget list', error);
      return [];
    } finally {
      this.#isListLoading.set(false);
    }
  }

  async preloadBudgetDetails(budgetIds: string[]): Promise<void> {
    const idsToLoad = budgetIds.filter(
      (id) =>
        !this.#budgetDetailsMap().has(id) && !this.#loadingDetailIds().has(id),
    );

    if (idsToLoad.length === 0) return;

    // Mark as loading
    this.#loadingDetailIds.update((set) => {
      const next = new Set(set);
      idsToLoad.forEach((id) => next.add(id));
      return next;
    });

    // Load all details in parallel
    const promises = idsToLoad.map(async (budgetId) => {
      try {
        const response = await firstValueFrom(
          this.#budgetApi.getBudgetWithDetails$(budgetId),
        );

        if (response.success && response.data) {
          const entry: BudgetDetailsEntry = {
            budget: response.data.budget,
            budgetLines: response.data.budgetLines,
            transactions: response.data.transactions,
          };

          this.#budgetDetailsMap.update((map) => {
            const next = new Map(map);
            next.set(budgetId, entry);
            return next;
          });
        }
      } catch (error) {
        this.#logger.error(
          `[BudgetCache] Failed to preload budget details for ${budgetId}`,
          error,
        );
      } finally {
        this.#loadingDetailIds.update((set) => {
          const next = new Set(set);
          next.delete(budgetId);
          return next;
        });
      }
    });

    await Promise.all(promises);
  }

  clear(): void {
    this.#budgets.set(null);
    this.#budgetDetailsMap.set(new Map());
    this.#loadingDetailIds.set(new Set());
    this.#isListLoading.set(false);
  }
}
