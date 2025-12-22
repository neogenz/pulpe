import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Logger } from '@core/logging/logger';

/**
 * Tour IDs that can be tracked
 */
export type TourId = 'currentMonth' | 'budget' | 'budgetTemplates';

interface TourCompletionState {
  currentMonth: boolean;
  budget: boolean;
  budgetTemplates: boolean;
}

const DEFAULT_STATE: TourCompletionState = {
  currentMonth: false,
  budget: false,
  budgetTemplates: false,
};

/**
 * Service managing tour completion state using reactive signals.
 * Provides centralized state management for feature discovery tours.
 */
@Injectable({
  providedIn: 'root',
})
export class TourStateService {
  readonly #logger = inject(Logger);
  readonly #STORAGE_KEY = 'pulpe-tour-state';

  // Private writable signal - initialized from localStorage
  readonly #completedTours = signal<TourCompletionState>(
    this.#readFromStorage(),
  );

  // Public readonly signals
  readonly completedTours = this.#completedTours.asReadonly();

  // Computed signals for each tour
  readonly isCurrentMonthCompleted = computed(
    () => this.#completedTours().currentMonth,
  );
  readonly isBudgetCompleted = computed(() => this.#completedTours().budget);
  readonly isTemplatesCompleted = computed(
    () => this.#completedTours().budgetTemplates,
  );

  // Check if a specific tour is completed
  readonly isTourCompleted = (tourId: TourId): boolean => {
    return this.#completedTours()[tourId];
  };

  constructor() {
    // Sync signal changes to localStorage
    effect(() => {
      this.#writeToStorage(this.#completedTours());
    });
  }

  /**
   * Mark a specific tour as completed
   */
  markTourCompleted(tourId: TourId): void {
    this.#logger.info('Tour completed', { tourId });
    this.#completedTours.update((state) => ({
      ...state,
      [tourId]: true,
    }));
  }

  /**
   * Reset all tours to allow replay
   */
  resetAllTours(): void {
    this.#logger.info('Resetting all tours');
    this.#completedTours.set({ ...DEFAULT_STATE });
  }

  #readFromStorage(): TourCompletionState {
    try {
      const stored = localStorage.getItem(this.#STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_STATE, ...JSON.parse(stored) };
      }
    } catch (error) {
      this.#logger.warn('Failed to read tour state from localStorage', error);
    }
    return { ...DEFAULT_STATE };
  }

  #writeToStorage(state: TourCompletionState): void {
    try {
      localStorage.setItem(this.#STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      this.#logger.warn('Failed to write tour state to localStorage', error);
    }
  }
}
