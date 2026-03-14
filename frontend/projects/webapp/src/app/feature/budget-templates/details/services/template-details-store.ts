import { inject, Injectable, signal, computed } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import {
  BudgetTemplatesApi,
  type BudgetTemplateDetailViewModel,
} from '@core/budget-template/budget-templates-api';

@Injectable()
export class TemplateDetailsStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  readonly #templateId = signal<string | null>(null);

  readonly #templateDetailsResource = cachedResource<
    BudgetTemplateDetailViewModel,
    { templateId: string }
  >({
    cache: this.#budgetTemplatesApi.cache,
    cacheKey: (params) => ['templates', 'details', params.templateId],
    params: () => {
      const id = this.#templateId();
      return id ? { templateId: id } : undefined;
    },
    loader: ({ params }) =>
      this.#budgetTemplatesApi.getDetail$(params.templateId),
  });

  readonly templateDetails = computed(
    () => this.#templateDetailsResource.value() ?? null,
  );
  readonly isLoading = computed(() =>
    this.#templateDetailsResource.isInitialLoading(),
  );
  readonly hasValue = computed(() => this.#templateDetailsResource.hasValue());
  readonly error = computed(() => this.#templateDetailsResource.error());

  // Derived selectors for convenience
  readonly template = computed(() => this.templateDetails()?.template ?? null);
  readonly templateLines = computed(
    () => this.templateDetails()?.transactions ?? [],
  );
  // Alias for backward compatibility
  readonly transactions = this.templateLines;

  initializeTemplateId(id: string): void {
    this.#templateId.set(id);
  }

  reloadTemplateDetails(): void {
    this.#templateDetailsResource.reload();
  }
}
