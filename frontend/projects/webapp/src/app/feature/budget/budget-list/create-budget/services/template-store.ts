import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  type TemplateLine,
  type BudgetTemplate,
  BudgetFormulas,
} from 'pulpe-shared';
import { TemplateApi } from '@core/budget-template/template-api';
import { Logger } from '@core/logging/logger';

export interface TemplateTotals {
  income: number;
  expenses: number;
  savings: number;
  netBalance: number;
}

/**
 * Centralized state for the TemplateStore
 */
interface TemplateStoreState {
  templates: BudgetTemplate[];
  selectedId: string | null;
  templateLinesCache: Map<string, TemplateLine[]>;
  templateTotalsMap: Record<string, TemplateTotals>;
  isLoading: boolean;
  error: Error | null;
}

@Injectable()
export class TemplateStore {
  readonly #templateApi = inject(TemplateApi);
  readonly #logger = inject(Logger);

  readonly #state = signal<TemplateStoreState>({
    templates: [],
    selectedId: null,
    templateLinesCache: new Map(),
    templateTotalsMap: {},
    isLoading: false,
    error: null,
  });

  readonly templates = computed(() => this.#state().templates);
  readonly selectedTemplateId = computed(() => this.#state().selectedId);
  readonly templateTotalsMap = computed(() => this.#state().templateTotalsMap);
  readonly isLoading = computed(() => this.#state().isLoading);
  readonly hasValue = computed(() => this.#state().templates.length > 0);
  readonly error = computed(() => this.#state().error);

  readonly selectedTemplate = computed(() => {
    const id = this.#state().selectedId;
    if (!id) return null;

    const allTemplates = this.#state().templates;
    return allTemplates.find((t) => t.id === id) || null;
  });

  readonly sortedTemplates = computed(() => {
    const templates = this.#state().templates;
    return [...templates].sort((a, b) => {
      // Default template always first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Then sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  getCachedTemplateLines(templateId: string): TemplateLine[] | null {
    return this.#state().templateLinesCache.get(templateId) || null;
  }

  selectTemplate(templateId: string): void {
    this.#state.update((state) => ({
      ...state,
      selectedId: templateId,
    }));
  }

  clearSelection(): void {
    this.#state.update((state) => ({
      ...state,
      selectedId: null,
    }));
  }

  initializeDefaultSelection(): void {
    if (this.#state().selectedId) return; // Already selected

    const allTemplates = this.#state().templates;
    const defaultTemplate = allTemplates.find((t) => t.isDefault);

    if (defaultTemplate) {
      this.selectTemplate(defaultTemplate.id);
    } else if (allTemplates.length > 0) {
      // Select the newest template if no default
      const sortedTemplates = [...allTemplates].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      this.selectTemplate(sortedTemplates[0].id);
    }
  }

  async loadTemplateLines(templateId: string): Promise<TemplateLine[]> {
    // Check cache first
    const cached = this.getCachedTemplateLines(templateId);
    if (cached) {
      return cached;
    }

    // Load from API
    try {
      const lines = await firstValueFrom(
        this.#templateApi.getTemplateLines$(templateId),
      );

      // Update cache
      this.#updateTemplateLinesCache(templateId, lines);

      return lines;
    } catch (error) {
      this.#logger.error('Error loading template lines:', error);
      this.#state.update((state) => ({
        ...state,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
      return [];
    }
  }

  async loadTemplateTotals(templateIds: string[]): Promise<void> {
    const currentTotals = this.#state().templateTotalsMap;

    // Filter templates that need loading
    const templatesToLoad = templateIds.filter((id) => !currentTotals[id]);

    if (templatesToLoad.length === 0) {
      return;
    }

    // Set loading states
    this.#setLoadingStates(templatesToLoad);

    try {
      // Load all template lines in parallel
      const templateLinesPromises = templatesToLoad.map(async (id) => ({
        id,
        lines: await this.loadTemplateLines(id),
      }));

      const templatesWithLines = await Promise.all(templateLinesPromises);

      const calculatedTotals = Object.fromEntries(
        templatesWithLines.map(({ id, lines }) => [
          id,
          this.#calculateTotals(lines),
        ]),
      );

      // Update totals map
      this.#state.update((state) => ({
        ...state,
        templateTotalsMap: {
          ...state.templateTotalsMap,
          ...calculatedTotals,
        },
      }));
    } catch (error) {
      this.#logger.error('Error loading template totals:', error);
      this.#setErrorStates(templatesToLoad);
    }
  }

  async loadSingleTemplateTotals(templateId: string): Promise<void> {
    await this.loadTemplateTotals([templateId]);
  }

  async loadTemplates(): Promise<void> {
    this.#state.update((state) => ({
      ...state,
      isLoading: true,
      error: null,
    }));

    try {
      const templates = await firstValueFrom(this.#templateApi.getAll$());
      this.#state.update((state) => ({
        ...state,
        templates: templates || [],
        isLoading: false,
      }));
    } catch (error) {
      this.#logger.error('Error loading templates:', error);
      this.#state.update((state) => ({
        ...state,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }

  clearCaches(): void {
    this.#state.update((state) => ({
      ...state,
      templateLinesCache: new Map(),
      templateTotalsMap: {},
    }));
  }

  invalidateTemplate(templateId: string): void {
    this.#state.update((state) => {
      const newLinesCache = new Map(state.templateLinesCache);
      newLinesCache.delete(templateId);

      const newTotalsMap = { ...state.templateTotalsMap };
      delete newTotalsMap[templateId];

      return {
        ...state,
        templateLinesCache: newLinesCache,
        templateTotalsMap: newTotalsMap,
      };
    });
  }

  async reloadTemplates(): Promise<void> {
    await this.loadTemplates();
  }

  #updateTemplateLinesCache(templateId: string, lines: TemplateLine[]): void {
    this.#state.update((state) => {
      const newCache = new Map(state.templateLinesCache);
      newCache.set(templateId, lines);
      return {
        ...state,
        templateLinesCache: newCache,
      };
    });
  }

  #setLoadingStates(templateIds: string[]): void {
    const loadingStates = templateIds.reduce(
      (acc, id) => {
        acc[id] = { income: 0, expenses: 0, savings: 0, netBalance: 0 };
        return acc;
      },
      {} as Record<string, TemplateTotals>,
    );

    this.#state.update((state) => ({
      ...state,
      templateTotalsMap: {
        ...state.templateTotalsMap,
        ...loadingStates,
      },
    }));
  }

  #setErrorStates(templateIds: string[]): void {
    const errorStates = templateIds.reduce(
      (acc, id) => {
        acc[id] = { income: 0, expenses: 0, savings: 0, netBalance: 0 };
        return acc;
      },
      {} as Record<string, TemplateTotals>,
    );

    this.#state.update((state) => ({
      ...state,
      templateTotalsMap: {
        ...state.templateTotalsMap,
        ...errorStates,
      },
    }));
  }

  #calculateTotals(lines: TemplateLine[]): TemplateTotals {
    const income = BudgetFormulas.calculateTotalIncome(lines, []);
    const totalExpenses = BudgetFormulas.calculateTotalExpenses(lines, []);
    const savings = BudgetFormulas.calculateTotalSavings(lines, []);
    return {
      income,
      expenses: totalExpenses - savings,
      savings,
      netBalance: income - totalExpenses,
    };
  }
}
