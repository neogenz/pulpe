import { Injectable, inject, resource, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type BudgetTemplate, type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesApi } from './budget-templates-api';

@Injectable()
export class BudgetTemplatesState {
  #budgetTemplatesApi = inject(BudgetTemplatesApi);

  // Business constants
  readonly MAX_TEMPLATES = 5;

  templatesData = resource<BudgetTemplate[], void>({
    loader: async () => this.#loadTemplatesData(),
  });

  // Business error signal
  businessError = signal<string | null>(null);

  // Selected template for detail view
  selectedTemplate = signal<BudgetTemplate | null>(null);

  // TODO: Future feature - Template usage tracking
  // templateUsageCount = computed(() => {
  //   // Track how many budgets use each template
  //   return new Map<string, number>();
  // });

  // TODO: Future feature - Soft delete/archive
  // archivedTemplates = signal<BudgetTemplate[]>([]);
  // showArchived = signal(false);

  // Computed signals for common derived state
  templateCount = computed(() => this.templatesData.value()?.length ?? 0);
  hasTemplates = computed(() => this.templateCount() > 0);
  isLoading = computed(
    () =>
      this.templatesData.status() === 'loading' ||
      this.templatesData.status() === 'reloading',
  );

  // Business logic computed signals
  canCreateMore = computed(() => this.templateCount() < this.MAX_TEMPLATES);
  remainingTemplates = computed(
    () => this.MAX_TEMPLATES - this.templateCount(),
  );
  currentDefaultTemplate = computed(
    () => this.templatesData.value()?.find((t) => t.isDefault) ?? null,
  );
  hasDefaultTemplate = computed(() => this.currentDefaultTemplate() !== null);

  refreshData(): void {
    if (this.templatesData.status() !== 'loading') {
      this.templatesData.reload();
    }
  }

  // Validation methods
  validateCanCreate(): boolean {
    if (!this.canCreateMore()) {
      this.businessError.set(
        `Vous avez atteint la limite de ${this.MAX_TEMPLATES} modèles`,
      );
      return false;
    }
    this.businessError.set(null);
    return true;
  }

  validateDefaultTemplate(isDefault: boolean): boolean {
    if (isDefault && this.hasDefaultTemplate()) {
      // We'll handle switching the default automatically
      return true;
    }
    return true;
  }

  selectTemplate(id: string): void {
    const template = this.templatesData.value()?.find((t) => t.id === id);
    this.selectedTemplate.set(template ?? null);
  }

  async addTemplate(
    template: BudgetTemplateCreate,
  ): Promise<BudgetTemplate | void> {
    // Validate business rules
    if (!this.validateCanCreate()) {
      throw new Error(this.businessError() || 'Cannot create template');
    }

    if (!this.validateDefaultTemplate(template.isDefault)) {
      throw new Error('Cannot set as default template');
    }
    this.templatesData.update((data) => {
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

      this.templatesData.update((data) => {
        if (!data || !response.data) return data;
        return data.map((t) => (t.id.startsWith('temp-') ? response.data : t));
      });

      // Return the created template for navigation
      return response.data;
    } catch (error) {
      this.templatesData.update((data) => {
        if (!data) return data;
        return data.filter((t) => !t.id.startsWith('temp-'));
      });
      this.businessError.set('Erreur lors de la création du modèle');
      throw error;
    }
  }

  async deleteTemplate(id: string): Promise<void> {
    const originalData = this.templatesData.value();

    // Optimistic update
    this.templatesData.update((data) => {
      if (!data) return data;
      return data.filter((t) => t.id !== id);
    });

    try {
      await firstValueFrom(this.#budgetTemplatesApi.delete$(id));
    } catch (error) {
      // Rollback on error
      if (originalData) {
        this.templatesData.update(() => originalData);
      }
      throw error;
    }
  }

  async #loadTemplatesData(): Promise<BudgetTemplate[]> {
    try {
      const response = await firstValueFrom(this.#budgetTemplatesApi.getAll$());
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      console.error('Erreur lors du chargement des templates:', error);
      throw error;
    }
  }
}
