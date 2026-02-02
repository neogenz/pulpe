import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { BudgetCache } from '@core/budget/budget-cache';

@Injectable()
export class BudgetNavigationService {
  readonly #budgetCache = inject(BudgetCache);

  readonly #budgetId = signal<string | null>(null);

  readonly #allBudgetsResource = resource({
    loader: async () => this.#budgetCache.preloadBudgetList(),
  });

  readonly #sortedBudgets = computed(() => {
    const budgets = this.#allBudgetsResource.value() ?? [];
    return [...budgets].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  });

  readonly #currentIndex = computed(() => {
    const currentId = this.#budgetId();
    return this.#sortedBudgets().findIndex((b) => b.id === currentId);
  });

  readonly previousBudgetId = computed(() => {
    const idx = this.#currentIndex();
    const sorted = this.#sortedBudgets();
    return idx > 0 ? sorted[idx - 1].id : null;
  });

  readonly nextBudgetId = computed(() => {
    const idx = this.#currentIndex();
    const sorted = this.#sortedBudgets();
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].id : null;
  });

  readonly hasPrevious = computed(() => this.previousBudgetId() !== null);
  readonly hasNext = computed(() => this.nextBudgetId() !== null);

  setCurrentBudgetId(budgetId: string): void {
    this.#budgetId.set(budgetId);
  }
}
