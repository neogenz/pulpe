import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
} from 'pulpe-shared';
import { map } from 'rxjs';
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

  readonly #templates = computed(() => this.budgetTemplates.value() ?? []);

  readonly templateCount = computed(() => this.#templates().length);

  readonly isTemplateLimitReached = computed(
    () => this.templateCount() >= this.MAX_TEMPLATES,
  );
  readonly remainingTemplates = computed(
    () => this.MAX_TEMPLATES - this.templateCount(),
  );
  readonly defaultBudgetTemplate = computed(
    () => this.#templates().find((t) => t.isDefault) ?? null,
  );

  readonly deleteTemplate = cachedMutation<string, void, BudgetTemplate[]>({
    cache: this.#budgetTemplatesApi.cache,
    invalidateKeys: (id) => [
      ['templates', 'list'],
      ['templates', 'details', id],
    ],
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

  // Note: We intentionally DON'T use optimistic update here.
  // The creation is fast (< 1s) and the user sees a spinner.
  // Optimistic update caused UI flicker issues because computed signals
  // would react to state changes during navigation.
  readonly #createTemplateMutation = cachedMutation<
    BudgetTemplateCreate,
    BudgetTemplateCreateResponse,
    void
  >({
    cache: this.#budgetTemplatesApi.cache,
    mutationFn: (template) => this.#budgetTemplatesApi.create$(template),
    invalidateKeys: () => [['templates']],
    onSuccess: (response) => {
      if (response.data.template) {
        this.budgetTemplates.update((data) => [
          ...(data ?? []),
          response.data.template!,
        ]);
        this.#budgetTemplatesApi.cacheTemplateDetail(response.data);
      }
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
    if (this.isTemplateLimitReached()) {
      throw new Error('Template limit reached');
    }

    const result = await this.#createTemplateMutation.mutate(template);
    return result?.data;
  }
}
