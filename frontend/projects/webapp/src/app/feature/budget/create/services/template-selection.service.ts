import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { startWith, map, debounceTime, firstValueFrom } from 'rxjs';
import { type BudgetTemplate, type TemplateLine } from '@pulpe/shared';
import { TemplateApi } from '../../../../core/template/template-api';

export interface TemplateTotals {
  totalIncome: number;
  totalExpenses: number;
  remainingLivingAllowance: number;
}

@Injectable()
export class TemplateSelectionService {
  readonly #templateApi = inject(TemplateApi);

  // Template details cache
  readonly templateDetailsCache = signal<Map<string, TemplateLine[]>>(
    new Map(),
  );

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

  clearSelectedTemplate(): void {
    this.selectedTemplateId.set(null);
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
   */
  calculateTemplateTotals(lines: TemplateLine[]): TemplateTotals {
    const totalIncome = lines
      .filter((line) => line.kind.toUpperCase() === 'INCOME')
      .reduce((sum, line) => sum + line.amount, 0);

    const totalExpenses = lines
      .filter(
        (line) =>
          line.kind.toUpperCase() === 'FIXED_EXPENSE' ||
          line.kind.toUpperCase() === 'SAVINGS_CONTRIBUTION',
      )
      .reduce((sum, line) => sum + line.amount, 0);

    const remainingLivingAllowance = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, remainingLivingAllowance };
  }

  /**
   * Get template totals from cache or calculate if available
   */
  getTemplateTotals(templateId: string): TemplateTotals | null {
    const lines = this.templateDetailsCache().get(templateId);
    if (!lines) {
      return null;
    }
    return this.calculateTemplateTotals(lines);
  }

  /**
   * Preload all template details for better UX
   */
  async preloadAllTemplateDetails(): Promise<void> {
    const templates = this.#templateApi.templatesResource.value() || [];

    // Load all template details in parallel
    await Promise.all(
      templates.map((template) => this.loadTemplateDetails(template.id)),
    );
  }
}
