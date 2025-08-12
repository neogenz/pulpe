import { Injectable, computed, inject, signal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith, map, debounceTime, firstValueFrom } from 'rxjs';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';
import { TemplateApi } from '../../../../../core/template/template-api';

export interface TemplateTotals {
  totalIncome: number;
  totalExpenses: number;
  remainingLivingAllowance: number;
  loading: boolean;
}

@Injectable()
export class TemplateSelection {
  readonly #templateApi = inject(TemplateApi);

  // Resource that fetches all templates for the current user
  readonly templates = resource({
    loader: async () => {
      const templates = await firstValueFrom(this.#templateApi.getAll$());
      return templates || [];
    },
  });

  // Template details cache
  readonly templateDetailsCache = signal<Map<string, TemplateLine[]>>(
    new Map(),
  );

  // Template totals cache with loading states
  readonly templateTotalsMap = signal<Record<string, TemplateTotals>>({});

  // Search functionality
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(''),
      debounceTime(300),
      map((term) => term.toLowerCase().trim()),
    ),
    { initialValue: '' },
  );

  // Selected template tracking
  readonly selectedTemplateId = signal<string | null>(null);

  // Computed filtered templates based on search, with default template first
  readonly filteredTemplates = computed(() => {
    const templates = this.templates.value() || [];
    const search = this.searchTerm();

    let filtered = templates;
    if (search) {
      filtered = templates.filter(
        (template: BudgetTemplate) =>
          template.name.toLowerCase().includes(search) ||
          template.description?.toLowerCase().includes(search),
      );
    }

    // Sort to put default template first
    return [...filtered].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    });
  });

  // Computed selected template - maintains selection even if filtered out
  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    if (!id) return null;

    // First, look in filtered templates
    const filteredTemplate = this.filteredTemplates().find((t) => t.id === id);
    if (filteredTemplate) return filteredTemplate;

    // If not found in filtered results, look in all templates
    // This ensures the selected template remains selected even when filtered out
    const allTemplates = this.templates.value() || [];
    return allTemplates.find((t) => t.id === id) || null;
  });

  selectTemplate(templateId: string): void {
    this.selectedTemplateId.set(templateId);
  }

  /**
   * Initialize selection with default template if no template is selected
   */
  initializeDefaultSelection(): void {
    if (this.selectedTemplateId()) return; // Already selected

    // Always look for default template in all templates, not just filtered ones
    const allTemplates = this.templates.value() || [];
    const defaultTemplate = allTemplates.find(
      (t: BudgetTemplate) => t.isDefault,
    );

    if (defaultTemplate) {
      this.selectedTemplateId.set(defaultTemplate.id);
    } else {
      // If no default template exists, select the first template sorted by creation date (newest first)
      // This provides predictable behavior regardless of search state
      const sortedTemplates = [...allTemplates].sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      if (sortedTemplates.length > 0) {
        this.selectedTemplateId.set(sortedTemplates[0].id);
      }
    }
  }

  /**
   * Load template details (lines) and cache them
   */
  async loadTemplateDetails(templateId: string): Promise<TemplateLine[]> {
    // Check cache first
    const cached = this.templateDetailsCache().get(templateId);
    if (cached) {
      return cached;
    }

    // Load from API
    try {
      const lines = await firstValueFrom(
        this.#templateApi.getTemplateLines$(templateId),
      );

      // Update cache
      const currentCache = this.templateDetailsCache();
      currentCache.set(templateId, lines);
      this.templateDetailsCache.set(new Map(currentCache));

      return lines;
    } catch (error) {
      console.error('Error loading template details:', error);
      return [];
    }
  }

  /**
   * Calculate template totals from template lines
   * Returns calculated totals with loading: false
   */
  calculateTemplateTotals(lines: TemplateLine[]): TemplateTotals {
    const totalIncome = lines
      .filter((line) => line.kind === 'income')
      .reduce((sum, line) => sum + line.amount, 0);

    const totalExpenses = lines
      .filter((line) => line.kind === 'expense' || line.kind === 'saving')
      .reduce((sum, line) => sum + line.amount, 0);

    const remainingLivingAllowance = totalIncome - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      remainingLivingAllowance,
      loading: false,
    };
  }

  /**
   * Load template totals for current filtered templates
   * This method manages loading states and caching
   */
  async loadTemplateTotalsForCurrentTemplates(): Promise<void> {
    const templates = this.filteredTemplates();
    const currentTotals = this.templateTotalsMap();

    // Only load templates that aren't already loaded or loading
    const templatesToLoad = templates.filter(
      (template) => !currentTotals[template.id],
    );

    if (templatesToLoad.length === 0) {
      return;
    }

    // Set loading state for templates that need to be loaded
    this.#setLoadingStatesForTemplates(templatesToLoad);

    try {
      // Load template details for all needed templates
      await Promise.all(
        templatesToLoad.map((template) =>
          this.loadTemplateDetails(template.id),
        ),
      );

      // Calculate and update totals for loaded templates
      this.#updateCalculatedTotalsForTemplates(templatesToLoad);
    } catch (error) {
      console.error('Error loading template totals:', error);
      this.#setErrorStatesForTemplates(templatesToLoad);
    }
  }

  #setLoadingStatesForTemplates(templates: BudgetTemplate[]): void {
    const loadingStates = templates.reduce(
      (acc, template) => {
        acc[template.id] = this.#createDefaultTotals(true);
        return acc;
      },
      {} as Record<string, TemplateTotals>,
    );

    this.templateTotalsMap.update((current) => ({
      ...current,
      ...loadingStates,
    }));
  }

  #updateCalculatedTotalsForTemplates(templates: BudgetTemplate[]): void {
    const calculatedTotals = templates.reduce(
      (acc, template) => {
        const lines = this.templateDetailsCache().get(template.id);
        if (lines) {
          acc[template.id] = this.calculateTemplateTotals(lines);
        } else {
          acc[template.id] = this.#createDefaultTotals(false);
        }
        return acc;
      },
      {} as Record<string, TemplateTotals>,
    );

    this.templateTotalsMap.update((current) => ({
      ...current,
      ...calculatedTotals,
    }));
  }

  #setErrorStatesForTemplates(templates: BudgetTemplate[]): void {
    const errorStates = templates.reduce(
      (acc, template) => {
        acc[template.id] = this.#createDefaultTotals(false);
        return acc;
      },
      {} as Record<string, TemplateTotals>,
    );

    this.templateTotalsMap.update((current) => ({
      ...current,
      ...errorStates,
    }));
  }

  #createDefaultTotals(loading: boolean): TemplateTotals {
    return {
      totalIncome: 0,
      totalExpenses: 0,
      remainingLivingAllowance: 0,
      loading,
    };
  }
}
