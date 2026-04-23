import { inject, Injectable, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { cachedResource } from 'ngx-ziflux';
import { BudgetTemplatesApi } from '@core/budget-template/budget-templates-api';
import {
  type BudgetTemplateResponse,
  type TemplateLineListResponse,
  type TemplateUsageResponse,
  BudgetFormulas,
} from 'pulpe-shared';

export interface BudgetTemplateDetailViewModel {
  template: BudgetTemplateResponse['data'];
  transactions: TemplateLineListResponse['data'];
}

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

  rawDetails(): BudgetTemplateDetailViewModel | undefined {
    return this.#templateDetailsResource.value();
  }

  setDetails(details: BudgetTemplateDetailViewModel): void {
    this.#templateDetailsResource.set(details);
  }

  async checkUsage(templateId: string): Promise<TemplateUsageResponse['data']> {
    const response = await firstValueFrom(
      this.#budgetTemplatesApi.checkUsage$(templateId),
    );
    return response.data;
  }
}
