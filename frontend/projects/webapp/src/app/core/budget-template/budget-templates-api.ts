import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import {
  type BudgetTemplateCreate,
  budgetTemplateCreateSchema,
  type BudgetTemplateCreateFromOnboarding,
  budgetTemplateCreateFromOnboardingSchema,
  type BudgetTemplateCreateResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse,
  type BudgetTemplateUpdate,
  budgetTemplateUpdateSchema,
  type TemplateLineListResponse,
  type TemplateLinesBulkUpdate,
  templateLinesBulkUpdateSchema,
  type TemplateLinesBulkUpdateResponse,
  type TemplateLinesBulkOperations,
  templateLinesBulkOperationsSchema,
  type TemplateLinesBulkOperationsResponse,
  type TemplateUsageResponse,
  budgetTemplateListResponseSchema,
  budgetTemplateResponseSchema,
  budgetTemplateCreateResponseSchema,
  budgetTemplateDeleteResponseSchema,
  templateLineListResponseSchema,
  templateLinesBulkUpdateResponseSchema,
  templateLinesBulkOperationsResponseSchema,
  templateUsageResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';
import { DataCache } from 'ngx-ziflux';

@Injectable({
  providedIn: 'root',
})
export class BudgetTemplatesApi {
  readonly #api = inject(ApiClient);
  readonly cache = new DataCache({
    name: 'templates',
    staleTime: 30_000,
    expireTime: 300_000,
  });

  clearCache(): void {
    this.cache.clear();
  }

  getAll$(): Observable<BudgetTemplateListResponse> {
    return this.#api.get$(
      '/budget-templates',
      budgetTemplateListResponseSchema,
    );
  }

  getById$(id: string): Observable<BudgetTemplateResponse> {
    return this.#api.get$(
      `/budget-templates/${id}`,
      budgetTemplateResponseSchema,
    );
  }

  create$(
    template: BudgetTemplateCreate,
  ): Observable<BudgetTemplateCreateResponse> {
    return this.#api.post$(
      '/budget-templates',
      template,
      budgetTemplateCreateResponseSchema,
      budgetTemplateCreateSchema,
    );
  }

  createFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): Observable<BudgetTemplateCreateResponse> {
    return this.#api.post$(
      '/budget-templates/from-onboarding',
      onboardingData,
      budgetTemplateCreateResponseSchema,
      budgetTemplateCreateFromOnboardingSchema,
    );
  }

  update$(
    id: string,
    updates: BudgetTemplateUpdate,
  ): Observable<BudgetTemplateResponse> {
    return this.#api.patch$(
      `/budget-templates/${id}`,
      updates,
      budgetTemplateResponseSchema,
      budgetTemplateUpdateSchema,
    );
  }

  getTemplateTransactions$(
    templateId: string,
  ): Observable<TemplateLineListResponse> {
    return this.#api.get$(
      `/budget-templates/${templateId}/lines`,
      templateLineListResponseSchema,
    );
  }

  updateTemplateLines$(
    templateId: string,
    bulkUpdate: TemplateLinesBulkUpdate,
  ): Observable<TemplateLinesBulkUpdateResponse> {
    return this.#api.patch$(
      `/budget-templates/${templateId}/lines`,
      bulkUpdate,
      templateLinesBulkUpdateResponseSchema,
      templateLinesBulkUpdateSchema,
    );
  }

  bulkOperationsTemplateLines$(
    templateId: string,
    bulkOperations: TemplateLinesBulkOperations,
  ): Observable<TemplateLinesBulkOperationsResponse> {
    return this.#api.post$(
      `/budget-templates/${templateId}/lines/bulk-operations`,
      bulkOperations,
      templateLinesBulkOperationsResponseSchema,
      templateLinesBulkOperationsSchema,
    );
  }

  delete$(id: string): Observable<BudgetTemplateDeleteResponse> {
    return this.#api.delete$(
      `/budget-templates/${id}`,
      budgetTemplateDeleteResponseSchema,
    );
  }

  checkUsage$(id: string): Observable<TemplateUsageResponse> {
    return this.#api.get$(
      `/budget-templates/${id}/usage`,
      templateUsageResponseSchema,
    );
  }
}
