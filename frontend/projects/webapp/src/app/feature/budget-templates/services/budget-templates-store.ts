import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
} from 'pulpe-shared';
import { firstValueFrom, map } from 'rxjs';
import { cachedResource, cachedMutation } from 'ngx-ziflux';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';

@Injectable()
export class BudgetTemplatesStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Business constants
  readonly MAX_TEMPLATES = 5;

  readonly budgetTemplates = cachedResource({
    cache: this.#budgetTemplatesApi.cache,
    cacheKey: ['templates', 'list'],
    loader: () =>
      this.#budgetTemplatesApi
        .getAll$()
        .pipe(
          map((response) =>
            Array.isArray(response.data) ? response.data : [],
          ),
        ),
  });
  readonly selectedTemplate = signal<BudgetTemplate | null>(null);

  // Filter out optimistic (temporary) templates for business logic computations
  // Temporary templates have IDs starting with "temp-"
  readonly #persistedTemplates = computed(
    () =>
      this.budgetTemplates.value()?.filter((t) => !t.id.startsWith('temp-')) ??
      [],
  );

  readonly templateCount = computed(() => this.#persistedTemplates().length);

  readonly isTemplateLimitReached = computed(
    () => this.templateCount() >= this.MAX_TEMPLATES,
  );
  readonly remainingTemplates = computed(
    () => this.MAX_TEMPLATES - this.templateCount(),
  );
  readonly defaultBudgetTemplate = computed(
    () => this.#persistedTemplates().find((t) => t.isDefault) ?? null,
  );

  readonly deleteTemplate = cachedMutation<string, void, BudgetTemplate[]>({
    cache: this.#budgetTemplatesApi.cache,
    mutationFn: (id) =>
      this.#budgetTemplatesApi.delete$(id).pipe(map(() => void 0 as void)),
    onMutate: (id) => {
      const previous = this.budgetTemplates.value() ?? [];
      this.budgetTemplates.update((data) =>
        (data ?? []).filter((t) => t.id !== id),
      );
      return previous;
    },
    onError: (_err, _id, previous) => {
      if (previous) this.budgetTemplates.set(previous);
    },
  });

  refreshData(): void {
    this.budgetTemplates.reload();
  }

  selectTemplate(id: string): void {
    const template = this.budgetTemplates.value()?.find((t) => t.id === id);
    this.selectedTemplate.set(template ?? null);
  }

  async addTemplate(
    template: BudgetTemplateCreate,
  ): Promise<BudgetTemplateCreateResponse['data'] | void> {
    // Validate business rules
    if (this.isTemplateLimitReached()) {
      throw new Error('Template limit reached');
    }

    // Note: We intentionally DON'T use optimistic update here.
    // The creation is fast (< 1s) and the user sees a spinner.
    // Optimistic update caused UI flicker issues because computed signals
    // would react to state changes during navigation.
    const response = await firstValueFrom(
      this.#budgetTemplatesApi.create$(template),
    );

    // Update list state with template only (lines don't belong in list)
    if (response.data.template) {
      this.budgetTemplates.update((data) => [
        ...(data ?? []),
        response.data.template!,
      ]);
    }

    // Pre-populate detail cache for SWR navigation
    if (response.data.template) {
      this.#budgetTemplatesApi.cache.set(
        ['templates', 'details', response.data.template.id],
        {
          template: response.data.template,
          transactions: response.data.lines ?? [],
        },
      );
    }

    // Return full data (template + lines) for SWR navigation
    return response.data;
  }
}
