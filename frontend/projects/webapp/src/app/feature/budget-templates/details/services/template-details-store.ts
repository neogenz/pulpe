import { inject, Injectable, signal, computed, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  BudgetTemplatesApi,
  type BudgetTemplateDetailViewModel,
} from '../../services/budget-templates-api';
import {
  type TemplateDetailsState,
  createInitialTemplateDetailsState,
} from './template-details-state';

/**
 * Signal-based store for template details state management
 * Implements SWR (Stale-While-Revalidate) pattern for instant display after creation
 */
@Injectable()
export class TemplateDetailsStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Single source of truth - private state signal for non-resource data
  readonly #state = signal<TemplateDetailsState>(
    createInitialTemplateDetailsState(),
  );

  // Stale data from navigation (POST response via router state)
  // Used for SWR: display immediately while fresh data loads in background
  readonly #staleData = signal<BudgetTemplateDetailViewModel | null>(null);

  // Resource for fresh data (background revalidation)
  readonly #templateDetailsResource = resource<
    BudgetTemplateDetailViewModel,
    string | null
  >({
    params: () => this.#state().templateId,
    loader: async ({ params: templateId }) => {
      if (!templateId) {
        throw new Error('Template ID is required');
      }
      return await firstValueFrom(
        this.#budgetTemplatesApi.getDetail$(templateId),
      );
    },
  });

  // SWR with computed(): fresh data takes priority, fallback to stale
  // Guard: resource.value() throws in error state, so check error() first
  readonly templateDetails = computed<BudgetTemplateDetailViewModel | null>(
    () =>
      this.#templateDetailsResource.error()
        ? this.#staleData()
        : (this.#templateDetailsResource.value() ?? this.#staleData()),
  );

  // Loading hidden if stale data available (smooth UX)
  readonly isLoading = computed(
    () => this.#templateDetailsResource.isLoading() && !this.#staleData(),
  );

  readonly hasValue = computed(() => !!this.templateDetails());
  readonly error = computed(
    () => this.#templateDetailsResource.error() || this.#state().error,
  );

  // Derived selectors for convenience
  readonly template = computed(() => this.templateDetails()?.template ?? null);
  readonly templateLines = computed(
    () => this.templateDetails()?.transactions ?? [],
  );
  // Alias for backward compatibility
  readonly transactions = this.templateLines;

  // Public Actions

  /**
   * Initialize template ID with optional stale data for SWR
   *
   * @param id - Template ID from route
   * @param staleData - Optional cached data from navigation (POST response)
   *
   * Behavior:
   * - With staleData: instant render + background fetch
   * - Without staleData: normal loading spinner (e.g., direct URL access)
   */
  initializeTemplateId(
    id: string,
    staleData?: BudgetTemplateDetailViewModel,
  ): void {
    // IMPORTANT: Set stale data BEFORE templateId to avoid loading flash
    // When templateId changes, resource triggers isLoading=true
    // Having staleData already set makes isLoading computed return false
    if (staleData) {
      this.#staleData.set(staleData);
    }

    this.#state.update((state) => ({
      ...state,
      templateId: id,
      error: null,
    }));
  }

  /**
   * Manually reload template details from the server
   */
  reloadTemplateDetails(): void {
    this.#templateDetailsResource.reload();
    this.#clearError();
  }

  /**
   * Clear the error state
   */
  #clearError(): void {
    this.#state.update((state) => ({
      ...state,
      error: null,
    }));
  }
}
