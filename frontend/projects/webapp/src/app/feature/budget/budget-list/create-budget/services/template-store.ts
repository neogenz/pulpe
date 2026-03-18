import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
import { cachedMutation, cachedResource } from 'ngx-ziflux';
import {
  type BudgetCreate,
  type TemplateLine,
  BudgetFormulas,
} from 'pulpe-shared';
import {
  BudgetApi,
  type CreateBudgetApiResponse,
} from '@core/budget/budget-api';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';

export interface TemplateTotals {
  income: number;
  expenses: number;
  savings: number;
  netBalance: number;
}

@Injectable()
export class TemplateStore {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  readonly #templatesResource = cachedResource({
    cache: this.#budgetTemplatesApi.cache,
    cacheKey: ['templates', 'list'],
    loader: () =>
      this.#budgetTemplatesApi
        .getAll$()
        .pipe(
          map((response) =>
            Array.isArray(response.data) ? response.data : [],
          ),
        ),
  });

  readonly #selectedId = signal<string | null>(null);
  readonly #templateTotalsMap = signal<Record<string, TemplateTotals>>({});

  readonly templates = computed(() => this.#templatesResource.value() ?? []);
  readonly selectedTemplateId = this.#selectedId.asReadonly();
  readonly isLoading = this.#templatesResource.isInitialLoading;
  readonly hasValue = computed(() => this.templates().length > 0);
  readonly error = this.#templatesResource.error;
  readonly templateTotalsMap = this.#templateTotalsMap.asReadonly();

  readonly selectedTemplate = computed(() => {
    const id = this.#selectedId();
    if (!id) return null;
    return this.templates().find((t) => t.id === id) || null;
  });

  readonly sortedTemplates = computed(() => {
    const templates = this.templates();
    return templates.toSorted((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  async loadTemplateLines(templateId: string): Promise<TemplateLine[]> {
    const cached = this.#budgetTemplatesApi.cache.get<TemplateLine[]>([
      'templates',
      'lines',
      templateId,
    ]);
    if (cached) return cached.data;

    const lines = await firstValueFrom(
      this.#budgetTemplatesApi
        .getTemplateTransactions$(templateId)
        .pipe(map((r) => r.data ?? [])),
    );
    this.#budgetTemplatesApi.cache.set(
      ['templates', 'lines', templateId],
      lines,
    );
    return lines;
  }

  async loadTemplateTotals(templateIds: string[]): Promise<void> {
    const current = this.#templateTotalsMap();
    const toLoad = templateIds.filter((id) => !current[id]);
    if (toLoad.length === 0) return;

    const results = await Promise.all(
      toLoad.map(async (id) => ({
        id,
        lines: await this.loadTemplateLines(id),
      })),
    );

    const newTotals = Object.fromEntries(
      results.map(({ id, lines }) => [id, this.#calculateTotals(lines)]),
    );

    this.#templateTotalsMap.update((current) => ({ ...current, ...newTotals }));
  }

  selectTemplate(templateId: string): void {
    this.#selectedId.set(templateId);
  }

  clearSelection(): void {
    this.#selectedId.set(null);
  }

  initializeDefaultSelection(): void {
    if (this.#selectedId()) return;
    const all = this.templates();
    const defaultTemplate = all.find((t) => t.isDefault);
    if (defaultTemplate) {
      this.selectTemplate(defaultTemplate.id);
    } else if (all.length > 0) {
      const sorted = all.toSorted(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      this.selectTemplate(sorted[0].id);
    }
  }

  reloadTemplates(): void {
    this.#templatesResource.reload();
  }

  readonly #createBudgetMutation = cachedMutation<
    BudgetCreate,
    CreateBudgetApiResponse
  >({
    cache: this.#budgetApi.cache,
    invalidateKeys: () => [['budget']],
    mutationFn: (data) => this.#budgetApi.createBudget$(data),
  });

  readonly isCreatingBudget = this.#createBudgetMutation.isPending;
  readonly createBudgetError = this.#createBudgetMutation.error;

  async createBudget(
    data: BudgetCreate,
  ): Promise<CreateBudgetApiResponse | undefined> {
    return this.#createBudgetMutation.mutate(data);
  }

  #calculateTotals(lines: TemplateLine[]): TemplateTotals {
    const income = BudgetFormulas.calculateTotalIncome(lines, []);
    const totalExpenses = BudgetFormulas.calculateTotalExpenses(lines, []);
    return {
      income,
      expenses: BudgetFormulas.calculateTotalExpenseOnly(lines, []),
      savings: BudgetFormulas.calculateTotalSavings(lines, []),
      netBalance: income - totalExpenses,
    };
  }
}
