import { Injectable, computed, inject, signal } from '@angular/core';
import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  type BudgetTemplateCreateResponse,
} from 'pulpe-shared';
import { catchError, firstValueFrom, map } from 'rxjs';
import { BudgetTemplatesApi } from './budget-templates-api';
import { rxResource } from '@angular/core/rxjs-interop';
import { Logger } from '@core/logging/logger';

@Injectable({ providedIn: 'root' })
export class BudgetTemplatesStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);
  readonly #logger = inject(Logger);

  // Business constants
  readonly MAX_TEMPLATES = 5;

  // Using rxResource for better error handling with HTTP errors
  budgetTemplates = rxResource<BudgetTemplate[], void>({
    stream: () =>
      this.#budgetTemplatesApi.getAll$().pipe(
        map((response) => (Array.isArray(response.data) ? response.data : [])),
        catchError((error) => {
          this.#logger.error('Erreur lors du chargement des templates:', error);
          // Return an error observable to properly set the resource status to 'error'
          throw error;
        }),
      ),
  });
  selectedTemplate = signal<BudgetTemplate | null>(null);

  // Filter out optimistic (temporary) templates for business logic computations
  // Temporary templates have IDs starting with "temp-"
  #persistedTemplates = computed(
    () =>
      this.budgetTemplates.value()?.filter((t) => !t.id.startsWith('temp-')) ??
      [],
  );

  templateCount = computed(() => this.#persistedTemplates().length);

  isTemplateLimitReached = computed(
    () => this.templateCount() >= this.MAX_TEMPLATES,
  );
  remainingTemplates = computed(
    () => this.MAX_TEMPLATES - this.templateCount(),
  );
  defaultBudgetTemplate = computed(
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
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.budgetTemplates.update(() => originalData);
      }
      throw error;
    }
  }
}
