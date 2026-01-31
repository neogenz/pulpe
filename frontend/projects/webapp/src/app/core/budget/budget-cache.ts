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
    // Auto-revalidate cache when budget mutations occur (signaled by version bump)
    effect(() => {
      const version = this.#invalidationService.version();
      untracked(() => {
        if (version === 0) return; // Skip initial value
        this.#revalidate();
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
  readonly #staleDetailIds = signal<Set<string>>(new Set());
  #listLoadPromise: Promise<Budget[]> | null = null;
  #isRevalidating = false;

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

  isBudgetDetailStale(budgetId: string): boolean {
    return this.#staleDetailIds().has(budgetId);
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
    if (this.#listLoadPromise) return this.#listLoadPromise;

    this.#listLoadPromise = this.#fetchBudgetList();
    return this.#listLoadPromise;
  }

  async #fetchBudgetList(): Promise<Budget[]> {
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
      this.#listLoadPromise = null;
    }
  }

  async preloadBudgetDetails(budgetIds: string[]): Promise<void> {
    const idsToLoad = budgetIds.filter(
      (id) =>
        (!this.#budgetDetailsMap().has(id) || this.#staleDetailIds().has(id)) &&
        !this.#loadingDetailIds().has(id),
    );

    if (idsToLoad.length === 0) return;

    // Mark as loading
    this.#loadingDetailIds.update((set) => {
      const next = new Set(set);
      idsToLoad.forEach((id) => next.add(id));
      return next;
    });

    // Load in batches to leave HTTP connection slots for user-initiated requests
    const BATCH_SIZE = 3;
    for (let i = 0; i < idsToLoad.length; i += BATCH_SIZE) {
      const batch = idsToLoad.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((budgetId) => this.#loadBudgetDetail(budgetId)),
      );
    }
  }

  async #loadBudgetDetail(budgetId: string): Promise<void> {
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

        this.#staleDetailIds.update((set) => {
          const next = new Set(set);
          next.delete(budgetId);
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
  }

  // Selective revalidation: re-fetch list only, mark details as stale — see DR-009 in memory-bank/techContext.md
  async #revalidate(): Promise<void> {
    if (this.#isRevalidating) return;
    this.#isRevalidating = true;

    this.#markAllDetailsStale();
    this.#budgets.set(null);
    this.#failedDetailIds.set(new Set());

    try {
      await this.preloadBudgetList();
    } catch (error) {
      this.#logger.error('[BudgetCache] Revalidation failed', error);
    } finally {
      this.#isRevalidating = false;
    }
  }

  #markAllDetailsStale(): void {
    const currentIds = this.#budgetDetailsMap().keys();
    this.#staleDetailIds.set(new Set(currentIds));
  }

  markAllDetailsStale(): void {
    this.#markAllDetailsStale();
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
    this.#staleDetailIds.set(new Set());
    this.#isListLoading.set(false);
  }
}
