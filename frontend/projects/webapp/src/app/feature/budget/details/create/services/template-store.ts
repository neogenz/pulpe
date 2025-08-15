import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type TemplateLine, type BudgetTemplate } from '@pulpe/shared';
import { TemplateApi } from '../../../../../core/template/template-api';
import { Logger } from '../../../../../core/logging/logger';
import {
  TemplateTotalsCalculator,
  type TemplateTotals,
} from './template-totals-calculator';

// Re-export for external use
export type { TemplateTotals };

/**
 * Centralized state for the TemplateStore
 */
interface TemplateStoreState {
  templates: BudgetTemplate[];
  selectedId: string | null;
  templateLinesCache: Map<string, TemplateLine[]>;
  templateTotalsMap: Record<string, TemplateTotals>;
  isLoadingTemplates: boolean;
  error: Error | null;
}

/**
 * Centralized state management for budget templates.
 * Handles loading, caching, and selection state.
 *
 * Follows STATE-PATTERN.md with a single centralized state signal.
 * Following Angular 20 naming convention (no .service suffix)
 */
@Injectable()
export class TemplateStore {
  readonly #templateApi = inject(TemplateApi);
  readonly #totalsCalculator = inject(TemplateTotalsCalculator);
  readonly #logger = inject(Logger);

  /**
   * Single source of truth for all store state
   */
  readonly #state = signal<TemplateStoreState>({
    templates: [],
    selectedId: null,
    templateLinesCache: new Map(),
    templateTotalsMap: {},
    isLoadingTemplates: false,
    error: null,
  });

  // Public read-only selectors via computed
  readonly templates = computed(() => this.#state().templates);
  readonly selectedTemplateId = computed(() => this.#state().selectedId);
  readonly templateTotalsMap = computed(() => this.#state().templateTotalsMap);
  readonly isLoadingTemplates = computed(
    () => this.#state().isLoadingTemplates,
  );
  readonly error = computed(() => this.#state().error);

  /**
   * Computed value for the currently selected template
   * Returns the full template object or null
   */
  readonly selectedTemplate = computed(() => {
    const id = this.#state().selectedId;
    if (!id) return null;

    const allTemplates = this.#state().templates;
    return allTemplates.find((t) => t.id === id) || null;
  });

  /**
   * Computed value for all templates sorted with default first
   */
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

  /**
   * Get cached template lines or null if not cached
   */
  getCachedTemplateLines(templateId: string): TemplateLine[] | null {
    return this.#state().templateLinesCache.get(templateId) || null;
  }

  /**
   * Select a template by ID
   */
  selectTemplate(templateId: string): void {
    this.#state.update((state) => ({
      ...state,
      selectedId: templateId,
    }));
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.#state.update((state) => ({
      ...state,
      selectedId: null,
    }));
  }

  /**
   * Initialize default selection
   * Selects the default template or the newest one
   */
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

  /**
   * Load template lines and cache them
   */
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

  /**
   * Load totals for multiple templates
   * Manages loading states and caching
   */
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

      // Calculate totals using the calculator service
      const calculatedTotals =
        this.#totalsCalculator.calculateBatchTotals(templatesWithLines);

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

  /**
   * Load totals for a single template
   */
  async loadSingleTemplateTotals(templateId: string): Promise<void> {
    await this.loadTemplateTotals([templateId]);
  }

  /**
   * Load all templates from API
   */
  async loadTemplates(): Promise<void> {
    this.#state.update((state) => ({
      ...state,
      isLoadingTemplates: true,
      error: null,
    }));

    try {
      const templates = await firstValueFrom(this.#templateApi.getAll$());
      this.#state.update((state) => ({
        ...state,
        templates: templates || [],
        isLoadingTemplates: false,
      }));
    } catch (error) {
      this.#logger.error('Error loading templates:', error);
      this.#state.update((state) => ({
        ...state,
        isLoadingTemplates: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      }));
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.#state.update((state) => ({
      ...state,
      templateLinesCache: new Map(),
      templateTotalsMap: {},
    }));
  }

  /**
   * Invalidate cache for a specific template
   */
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

  /**
   * Reload templates from API
   */
  async reloadTemplates(): Promise<void> {
    await this.loadTemplates();
  }

  /**
   * Update template lines cache
   */
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

  /**
   * Set loading states for templates
   */
  #setLoadingStates(templateIds: string[]): void {
    const loadingStates = templateIds.reduce(
      (acc, id) => {
        acc[id] = this.#totalsCalculator.createDefaultTotals(true);
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

  /**
   * Set error states for templates that failed to load
   */
  #setErrorStates(templateIds: string[]): void {
    const errorStates = templateIds.reduce(
      (acc, id) => {
        acc[id] = this.#totalsCalculator.createDefaultTotals(false);
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
}
