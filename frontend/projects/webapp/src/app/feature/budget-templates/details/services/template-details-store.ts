import { inject, Injectable, computed, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { createStaleFallback } from '@core/cache';
import {
  BudgetTemplatesApi,
  type BudgetTemplateDetailViewModel,
} from '../../services/budget-templates-api';
import { createInitialTemplateDetailsState } from './template-details-state';

@Injectable()
export class TemplateDetailsStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  readonly #state = createInitialTemplateDetailsState();

  // Resource for fresh data (background revalidation)
  readonly #templateDetailsResource = resource<
    BudgetTemplateDetailViewModel,
    string | null
  >({
    params: () => this.#state.templateId(),
    loader: async ({ params: templateId }) => {
      if (!templateId) {
        throw new Error('Template ID is required');
      }
      return await firstValueFrom(
        this.#budgetTemplatesApi.getDetail$(templateId),
      );
    },
  });

  readonly #swr = createStaleFallback({
    resource: this.#templateDetailsResource,
  });
  readonly templateDetails = this.#swr.data;
  // Loading hidden if stale data available (smooth UX)
  readonly isLoading = this.#swr.isInitialLoading;
  readonly hasValue = this.#swr.hasValue;
  readonly error = computed(
    () => this.#templateDetailsResource.error() || this.#state.error(),
  );

  // Derived selectors for convenience
  readonly template = computed(() => this.templateDetails()?.template ?? null);
  readonly templateLines = computed(
    () => this.templateDetails()?.transactions ?? [],
  );
  // Alias for backward compatibility
  readonly transactions = this.templateLines;

  // Public Actions

  initializeTemplateId(
    id: string,
    staleData?: BudgetTemplateDetailViewModel,
  ): void {
    // IMPORTANT: Set stale data BEFORE templateId to avoid loading flash
    // When templateId changes, resource triggers isLoading=true
    // Having staleData already set makes isLoading computed return false
    if (staleData) {
      this.#swr.setStaleData(staleData);
    }

    this.#state.templateId.set(id);
    this.#state.error.set(null);
  }

  reloadTemplateDetails(): void {
    this.#templateDetailsResource.reload();
    this.#clearError();
  }

  #clearError(): void {
    this.#state.error.set(null);
  }
}
