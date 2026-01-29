import {
  Injectable,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { type Budget, type BudgetDetailsResponse } from 'pulpe-shared';
import { filter, firstValueFrom, first, timeout } from 'rxjs';
import { BudgetApi } from './budget-api';
import { BudgetInvalidationService } from './budget-invalidation.service';
import { Logger } from '../logging/logger';

interface BudgetDetailsEntry {
  readonly budget: Budget;
  readonly budgetLines: BudgetDetailsResponse['data']['budgetLines'];
  readonly transactions: BudgetDetailsResponse['data']['transactions'];
}

@Injectable({ providedIn: 'root' })
export class BudgetCache {
  readonly #budgetApi = inject(BudgetApi);
  readonly #invalidationService = inject(BudgetInvalidationService);
  readonly #logger = inject(Logger);

  constructor() {
    // Auto-invalidate cache when budget mutations occur (signaled by version bump)
    effect(() => {
      const version = this.#invalidationService.version();
      untracked(() => {
        if (version === 0) return; // Skip initial value
        this.invalidateBudgetList();
        this.#budgetDetailsMap.set(new Map());
      });
    });
  }

  readonly #budgets = signal<Budget[] | null>(null);
  readonly #budgetDetailsMap = signal<Map<string, BudgetDetailsEntry>>(
    new Map(),
  );
  readonly #isListLoading = signal(false);
  readonly #loadingDetailIds = signal<Set<string>>(new Set());
  readonly #failedDetailIds = signal<Set<string>>(new Set());

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

  async waitForBudgetDetails(
    budgetId: string,
  ): Promise<BudgetDetailsEntry | null> {
    const cached = this.getBudgetDetails(budgetId);
    if (cached) return cached;

    // Fail fast if preload already failed for this ID
    if (this.#failedDetailIds().has(budgetId)) return null;

    // Wait for this specific budget detail to appear in the map (with timeout)
    const detailsMap$ = toObservable(this.#budgetDetailsMap);
    try {
      const map = await firstValueFrom(
        detailsMap$.pipe(
          filter((m) => m.has(budgetId)),
          first(),
          timeout(10_000),
        ),
      );
      return map.get(budgetId)!;
    } catch {
      return null;
    }
  }

  async preloadBudgetList(): Promise<Budget[]> {
    const cached = this.#budgets();
    if (cached !== null) return cached;
    if (this.#isListLoading()) return [];

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
        this.#failedDetailIds.update((set) => {
          const next = new Set(set);
          next.add(budgetId);
          return next;
        });
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

  invalidateBudgetList(): void {
    this.#budgets.set(null);
  }

  invalidateBudgetDetails(budgetId: string): void {
    this.#budgetDetailsMap.update((map) => {
      const next = new Map(map);
      next.delete(budgetId);
      return next;
    });
  }

  clear(): void {
    this.#budgets.set(null);
    this.#budgetDetailsMap.set(new Map());
    this.#loadingDetailIds.set(new Set());
    this.#failedDetailIds.set(new Set());
    this.#isListLoading.set(false);
  }
}
