import { inject, Injectable, signal, computed } from '@angular/core';
import { cachedResource } from 'ngx-ziflux';
import {
  BudgetTemplatesApi,
  type BudgetTemplateDetailViewModel,
} from '@core/budget-template/budget-templates-api';
import { type TemplateLine, BudgetFormulas } from 'pulpe-shared';
import type { FinancialEntry } from '../components';

const KIND_ORDER: Record<string, number> = {
  income: 1,
  saving: 2,
  expense: 3,
} as const;

@Injectable()
export class TemplateDetailsStore {
  readonly #budgetTemplatesApi = inject(BudgetTemplatesApi);

  readonly #templateId = signal<string | null>(null);

  readonly #templateDetailsResource = cachedResource<
    BudgetTemplateDetailViewModel,
    { templateId: string }
  >({
    cache: this.#budgetTemplatesApi.cache,
    cacheKey: (params) => ['templates', 'details', params.templateId],
    params: () => {
      const id = this.#templateId();
      return id ? { templateId: id } : undefined;
    },
    loader: ({ params }) =>
      this.#budgetTemplatesApi.getDetail$(params.templateId),
  });

  readonly templateDetails = computed(
    () => this.#templateDetailsResource.value() ?? null,
  );
  readonly isLoading = this.#templateDetailsResource.isInitialLoading;
  readonly hasValue = computed(() => this.#templateDetailsResource.hasValue());
  readonly error = this.#templateDetailsResource.error;

  readonly template = computed(() => this.templateDetails()?.template ?? null);
  readonly templateLines = computed(
    () => this.templateDetails()?.transactions ?? [],
  );
  readonly transactions = this.templateLines;

  readonly entries = computed<FinancialEntry[]>(() => {
    const transactions = this.templateLines();

    const sortedTransactions = [...transactions].sort((a, b) => {
      const kindDiff =
        (KIND_ORDER[a.kind] ?? Infinity) - (KIND_ORDER[b.kind] ?? Infinity);
      if (kindDiff !== 0) return kindDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return sortedTransactions.map((transaction: TemplateLine) => {
      const spent = transaction.kind === 'expense' ? transaction.amount : 0;
      const earned = transaction.kind === 'income' ? transaction.amount : 0;
      const saved = transaction.kind === 'saving' ? transaction.amount : 0;
      return {
        description: transaction.name,
        spent,
        earned,
        saved,
        total: earned - spent,
      };
    });
  });

  readonly totals = computed(() => {
    const lines = this.templateLines();
    const income = BudgetFormulas.calculateTotalIncome(lines);
    const savings = BudgetFormulas.calculateTotalSavings(lines);
    const expense = BudgetFormulas.calculateTotalExpenses(lines) - savings;
    return { income, expense, savings };
  });

  readonly netBalance = computed(() => {
    const lines = this.templateLines();
    const income = BudgetFormulas.calculateTotalIncome(lines);
    const totalExpenses = BudgetFormulas.calculateTotalExpenses(lines);
    return income - totalExpenses;
  });

  initializeTemplateId(id: string): void {
    this.#templateId.set(id);
  }

  reloadTemplateDetails(): void {
    this.#templateDetailsResource.reload();
  }
}
