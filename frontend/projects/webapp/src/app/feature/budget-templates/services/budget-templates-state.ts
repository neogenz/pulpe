import { Injectable, computed, inject, signal } from '@angular/core';
import { type BudgetTemplate, type BudgetTemplateCreate } from '@pulpe/shared';
import { catchError, firstValueFrom, map } from 'rxjs';
import { BudgetTemplatesApi } from './budget-templates-api';
import { rxResource } from '@angular/core/rxjs-interop';
import { Logger } from '@core/logging/logger';

@Injectable()
export class BudgetTemplatesState {
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
  templateCount = computed(() => this.budgetTemplates.value()?.length ?? 0);

  isTemplateLimitReached = computed(
    () => this.templateCount() >= this.MAX_TEMPLATES,
  );
  remainingTemplates = computed(
    () => this.MAX_TEMPLATES - this.templateCount(),
  );
  defaultBudgetTemplate = computed(
    () => this.budgetTemplates.value()?.find((t) => t.isDefault) ?? null,
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
  ): Promise<BudgetTemplate | void> {
    // Validate business rules
    if (this.isTemplateLimitReached()) {
      throw new Error('Template limit reached');
    }

    this.budgetTemplates.update((data) => {
      if (!data) return data;
      const optimisticTemplate: BudgetTemplate = {
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: undefined,
        name: template.name,
        description: template.description ?? undefined,
        // category: template.category ?? undefined, // Removed: category field doesn't exist in schema
        isDefault: template.isDefault ?? false,
      };
      return [...data, optimisticTemplate];
    });

    try {
      const response = await firstValueFrom(
        this.#budgetTemplatesApi.create$(template),
      );

      this.budgetTemplates.update((data) => {
        if (!data || !response.data) return data;
        return data.map((t) => (t.id.startsWith('temp-') ? response.data : t));
      });

      // Return the created template for navigation
      return response.data;
    } catch (error) {
      this.budgetTemplates.update((data) => {
        if (!data) return data;
        return data.filter((t) => !t.id.startsWith('temp-'));
      });
      throw error;
    }
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
