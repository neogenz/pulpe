import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
} from 'pulpe-shared';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { BudgetTemplatesApi } from './budget-templates-api';
import { rxResource } from '@angular/core/rxjs-interop';
import { Logger } from '@core/logging/logger';
import { TemplateCache } from '@core/template/template-cache';

@Injectable()
export class BudgetTemplatesStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #templateCache = inject(TemplateCache);
  readonly #logger = inject(Logger);

  // Business constants
  readonly MAX_TEMPLATES = 5;

  readonly budgetTemplates = rxResource<
    BudgetTemplate[],
    { hasCache: boolean }
  >({
    params: () => ({ hasCache: this.#templateCache.hasTemplates() }),
    stream: ({ params }) => {
      if (params.hasCache) {
        const cached = this.#templateCache.templates();
        if (cached) return of(cached);
      }
      return this.#budgetTemplatesApi.getAll$().pipe(
        map((response) => (Array.isArray(response.data) ? response.data : [])),
        catchError((error) => {
          this.#logger.error('Erreur lors du chargement des templates:', error);
          throw error;
        }),
      );
    },
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

  refreshData(): void {
    if (this.budgetTemplates.status() !== 'loading') {
      this.budgetTemplates.reload();
    }
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

    this.#templateCache.invalidate();

    // Update list state with template only (lines don't belong in list)
    this.budgetTemplates.update((data) => {
      if (!data || !response.data.template) return data;
      return [...data, response.data.template];
    });

    // Return full data (template + lines) for SWR navigation
    return response.data;
  }
  async deleteTemplate(id: string): Promise<void> {
    const originalData = this.budgetTemplates.value();

    // Optimistic update
    this.budgetTemplates.update((data) => {
      if (!data) return data;
      return data.filter((t) => t.id !== id);
    });

    try {
      await firstValueFrom(this.#budgetTemplatesApi.delete$(id));
      this.#templateCache.invalidate();
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.budgetTemplates.update(() => originalData);
      }
      throw error;
    }
  }
}
