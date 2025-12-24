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
 * Follows the reactive patterns with single state signal and resource separation
 */
@Injectable()
export class TemplateDetailsStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Single source of truth - private state signal for non-resource data
  readonly #state = signal<TemplateDetailsState>(
    createInitialTemplateDetailsState(),
  );

  // Preloaded data from navigation (avoids initial fetch after creation)
  readonly #preloadedData = signal<BudgetTemplateDetailViewModel | null>(null);

  // Resource for template details data - managed independently
  readonly #templateDetailsResource = resource<
    BudgetTemplateDetailViewModel,
    string | null
  >({
    params: () => this.#state().templateId,
    loader: async ({ params: templateId }) => {
      if (!templateId) {
        throw new Error('Template ID is required');
      }
      const preloaded = this.#preloadedData();
      if (preloaded && preloaded.template.id === templateId) {
        this.#preloadedData.set(null);
        return preloaded;
      }
      return await firstValueFrom(
        this.#budgetTemplatesApi.getDetail$(templateId),
      );
    },
  });

  // Public selectors (read-only computed signals)
  readonly isLoading = computed(() =>
    this.#templateDetailsResource.isLoading(),
  );
  readonly hasValue = computed(() => this.#templateDetailsResource.hasValue());
  readonly error = computed(
    () => this.#templateDetailsResource.error() || this.#state().error,
  );

  // Derived selectors for convenience
  readonly templateDetails = computed(
    () => this.#templateDetailsResource.value() ?? null,
  );
  readonly template = computed(() => this.templateDetails()?.template ?? null);
  readonly templateLines = computed(
    () => this.templateDetails()?.transactions ?? [],
  );
  // Alias for backward compatibility
  readonly transactions = this.templateLines;

  // Public Actions

  /**
   * Initialize the template ID (called once from component)
   */
  initializeTemplateId(id: string): void {
    this.#state.update((state) => ({
      ...state,
      templateId: id,
      error: null,
    }));
  }

  /**
   * Initialize with preloaded data (avoids initial API fetch after creation)
   */
  initializeWithData(data: BudgetTemplateDetailViewModel): void {
    this.#preloadedData.set(data);
    this.#state.update((state) => ({
      ...state,
      templateId: data.template.id,
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
