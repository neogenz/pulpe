import { inject, Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { cachedResource } from 'ngx-ziflux';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import {
  type TemplateLine,
  type BudgetTemplateResponse,
  type TemplateLineListResponse,
  type TemplateUsageResponse,
  BudgetFormulas,
} from 'pulpe-shared';
import type { FinancialEntry } from '../components';

export interface BudgetTemplateDetailViewModel {
  template: BudgetTemplateResponse['data'];
  transactions: TemplateLineListResponse['data'];
}

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
    loader: async ({ params }) => {
      const [templateRes, linesRes] = await Promise.all([
        firstValueFrom(this.#budgetTemplatesApi.getById$(params.templateId)),
        firstValueFrom(
          this.#budgetTemplatesApi.getTemplateTransactions$(params.templateId),
        ),
      ]);
      if (!templateRes.data) {
        throw new Error(`Template with id ${params.templateId} not found`);
      }
      return { template: templateRes.data, transactions: linesRes.data || [] };
    },
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
  readonly entries = computed<FinancialEntry[]>(() => {
    const transactions = this.templateLines();

    const sortedTransactions = transactions.toSorted((a, b) => {
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
    return {
      income: BudgetFormulas.calculateTotalIncome(lines),
      expense: BudgetFormulas.calculateTotalExpenseOnly(lines),
      savings: BudgetFormulas.calculateTotalSavings(lines),
    };
  });

  readonly netBalance = computed(() => {
    const t = this.totals();
    return t.income - t.expense - t.savings;
  });

  initializeTemplateId(id: string): void {
    this.#templateId.set(id);
  }

  reloadTemplateDetails(): void {
    this.#templateDetailsResource.reload();
  }

  async checkUsage(templateId: string): Promise<TemplateUsageResponse['data']> {
    const response = await firstValueFrom(
      this.#budgetTemplatesApi.checkUsage$(templateId),
    );
    return response.data;
  }
}
