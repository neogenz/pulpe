import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith, map, debounceTime, firstValueFrom } from 'rxjs';
import {
  transactionKindSchema,
  type BudgetTemplate,
  type TemplateLine,
} from '@pulpe/shared';
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

  // Computed filtered templates based on search
  readonly filteredTemplates = computed(() => {
    const templates = this.#templateApi.templatesResource.value() || [];
    const search = this.searchTerm();

    if (!search) {
      return templates;
    }

    return templates.filter(
      (template: BudgetTemplate) =>
        template.name.toLowerCase().includes(search) ||
        template.description?.toLowerCase().includes(search),
    );
  });

  // Computed selected template
  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    if (!id) return null;

    return this.filteredTemplates().find((t) => t.id === id) || null;
  });

  selectTemplate(templateId: string): void {
    this.selectedTemplateId.set(templateId);
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
      .filter(
        (line) =>
          line.kind.toUpperCase() === transactionKindSchema.Values.INCOME,
      )
      .reduce((sum, line) => sum + line.amount, 0);

    const totalExpenses = lines
      .filter(
        (line) =>
          line.kind.toUpperCase() ===
            transactionKindSchema.Values.FIXED_EXPENSE ||
          line.kind.toUpperCase() ===
            transactionKindSchema.Values.SAVINGS_CONTRIBUTION,
      )
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
