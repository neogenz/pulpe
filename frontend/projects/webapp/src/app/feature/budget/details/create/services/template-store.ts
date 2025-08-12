import { Injectable, computed, inject, signal, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type TemplateLine } from '@pulpe/shared';
import { TemplateApi } from '../../../../../core/template/template-api';
import {
  TemplateTotalsCalculator,
  type TemplateTotals,
} from './template-totals-calculator';

/**
 * Centralized state management for budget templates.
 * Handles resource loading, caching, and selection state.
 *
 * Following Angular 20 naming convention (no .service suffix)
 */
@Injectable()
export class TemplateStore {
  readonly #templateApi = inject(TemplateApi);
  readonly #totalsCalculator = inject(TemplateTotalsCalculator);

  /**
   * Resource that fetches all templates for the current user
   * Using Angular 20 resource API for automatic loading states
   */
  readonly templates = resource({
    loader: async () => {
      const templates = await firstValueFrom(this.#templateApi.getAll$());
      return templates || [];
    },
  });

  /**
   * Cache for template details (lines)
   * Key: template ID, Value: template lines
   */
  readonly #templateDetailsCache = signal<Map<string, TemplateLine[]>>(
    new Map(),
  );

  /**
   * Map of template totals with loading states
   * Key: template ID, Value: calculated totals
   */
  readonly templateTotalsMap = signal<Record<string, TemplateTotals>>({});

  /**
   * Currently selected template ID
   */
  readonly selectedTemplateId = signal<string | null>(null);

  /**
   * Computed value for the currently selected template
   * Returns the full template object or null
   */
  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    if (!id) return null;

    const allTemplates = this.templates.value() || [];
    return allTemplates.find((t) => t.id === id) || null;
  });

  /**
   * Computed value for all templates sorted with default first
   */
  readonly sortedTemplates = computed(() => {
    const templates = this.templates.value() || [];
    return [...templates].sort((a, b) => {
      // Default template always first
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      // Then sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  /**
   * Get cached template details or null if not cached
   */
  getCachedTemplateDetails(templateId: string): TemplateLine[] | null {
    return this.#templateDetailsCache().get(templateId) || null;
  }

  /**
   * Select a template by ID
   */
  selectTemplate(templateId: string): void {
    this.selectedTemplateId.set(templateId);
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    this.selectedTemplateId.set(null);
  }

  /**
   * Initialize default selection
   * Selects the default template or the newest one
   */
  initializeDefaultSelection(): void {
    if (this.selectedTemplateId()) return; // Already selected

    const allTemplates = this.templates.value() || [];
    const defaultTemplate = allTemplates.find((t) => t.isDefault);

    if (defaultTemplate) {
      this.selectedTemplateId.set(defaultTemplate.id);
    } else if (allTemplates.length > 0) {
      // Select the newest template if no default
      const sortedTemplates = [...allTemplates].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      this.selectedTemplateId.set(sortedTemplates[0].id);
    }
  }

  /**
   * Load template details and cache them
   */
  async loadTemplateDetails(templateId: string): Promise<TemplateLine[]> {
    // Check cache first
    const cached = this.getCachedTemplateDetails(templateId);
    if (cached) {
      return cached;
    }

    // Load from API
    try {
      const lines = await firstValueFrom(
        this.#templateApi.getTemplateLines$(templateId),
      );

      // Update cache
      this.#updateTemplateDetailsCache(templateId, lines);

      return lines;
    } catch (error) {
      console.error('Error loading template details:', error);
      return [];
    }
  }

  /**
   * Load totals for multiple templates
   * Manages loading states and caching
   */
  async loadTemplateTotals(templateIds: string[]): Promise<void> {
    const currentTotals = this.templateTotalsMap();

    // Filter templates that need loading
    const templatesToLoad = templateIds.filter((id) => !currentTotals[id]);

    if (templatesToLoad.length === 0) {
      return;
    }

    // Set loading states
    this.#setLoadingStates(templatesToLoad);

    try {
      // Load all template details in parallel
      const templateDetailsPromises = templatesToLoad.map(async (id) => ({
        id,
        lines: await this.loadTemplateDetails(id),
      }));

      const templatesWithLines = await Promise.all(templateDetailsPromises);

      // Calculate totals using the calculator service
      const calculatedTotals =
        this.#totalsCalculator.calculateBatchTotals(templatesWithLines);

      // Update totals map
      this.templateTotalsMap.update((current) => ({
        ...current,
        ...calculatedTotals,
      }));
    } catch (error) {
      console.error('Error loading template totals:', error);
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
   * Clear all caches
   */
  clearCaches(): void {
    this.#templateDetailsCache.set(new Map());
    this.templateTotalsMap.set({});
  }

  /**
   * Invalidate cache for a specific template
   */
  invalidateTemplate(templateId: string): void {
    // Remove from details cache
    const detailsCache = this.#templateDetailsCache();
    detailsCache.delete(templateId);
    this.#templateDetailsCache.set(new Map(detailsCache));

    // Remove from totals map
    this.templateTotalsMap.update((current) => {
      const updated = { ...current };
      delete updated[templateId];
      return updated;
    });
  }

  /**
   * Reload templates resource
   */
  reloadTemplates(): void {
    this.templates.reload();
  }

  /**
   * Update template details cache
   */
  #updateTemplateDetailsCache(templateId: string, lines: TemplateLine[]): void {
    const currentCache = this.#templateDetailsCache();
    currentCache.set(templateId, lines);
    this.#templateDetailsCache.set(new Map(currentCache));
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

    this.templateTotalsMap.update((current) => ({
      ...current,
      ...loadingStates,
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

    this.templateTotalsMap.update((current) => ({
      ...current,
      ...errorStates,
    }));
  }
}
