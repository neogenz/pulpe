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
  readonly #selectedTemplateId = signal<string | null>(null);
  readonly selectedTemplate = computed(() => {
    const id = this.#selectedTemplateId();
    if (!id) return null;
    return this.budgetTemplates.value()?.find((t) => t.id === id) ?? null;
  });

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

  readonly #deleteTemplateMutation = cachedMutation<
    string,
    void,
    BudgetTemplate[]
  >({
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

  readonly deleteTemplateError = computed(() =>
    this.#deleteTemplateMutation.error(),
  );

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
        this.#budgetTemplatesApi.cache.set(
          ['templates', 'details', response.data.template.id],
          {
            template: response.data.template,
            transactions: response.data.lines ?? [],
          },
        );
      }
    },
  });

  refreshData(): void {
    this.budgetTemplates.reload();
  }

  selectTemplate(id: string): void {
    this.#selectedTemplateId.set(id);
  }

  async deleteTemplate(id: string): Promise<void> {
    await this.#deleteTemplateMutation.mutate(id);
  }

  async addTemplate(
    template: BudgetTemplateCreate,
  ): Promise<BudgetTemplateCreateResponse['data'] | undefined> {
    if (this.isTemplateLimitReached()) {
      throw new Error('Template limit reached');
    }

    const result = await this.#createTemplateMutation.mutate(template);
    if (!result) {
      throw (
        this.#createTemplateMutation.error() ??
        new Error('Failed to create template')
      );
    }
    return result.data;
  }
}
