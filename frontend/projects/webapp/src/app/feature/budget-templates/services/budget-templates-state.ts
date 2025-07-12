import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type BudgetTemplate, type BudgetTemplateCreate } from '@pulpe/shared';
import { BudgetTemplatesApi } from './budget-templates-api';

@Injectable()
export class BudgetTemplatesState {
  #budgetTemplatesApi = inject(BudgetTemplatesApi);

  templatesData = resource<BudgetTemplate[], void>({
    loader: async () => this.#loadTemplatesData(),
  });

  refreshData(): void {
    if (this.templatesData.status() !== 'loading') {
      this.templatesData.reload();
    }
  }

  async addTemplate(template: BudgetTemplateCreate): Promise<void> {
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
    } catch (error) {
      this.templatesData.update((data) => {
        if (!data) return data;
        return data.filter((t) => !t.id.startsWith('temp-'));
      });
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
