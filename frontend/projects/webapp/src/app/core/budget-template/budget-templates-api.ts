import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateCreateFromOnboarding,
  type BudgetTemplateCreateResponse,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse,
  type TemplateLineListResponse,
  type TemplateLinesBulkUpdate,
  type TemplateLinesBulkUpdateResponse,
  type TemplateLinesBulkOperations,
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
    );
  }

  createFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): Observable<BudgetTemplateCreateResponse> {
    return this.#api.post$(
      '/budget-templates/from-onboarding',
      onboardingData,
      budgetTemplateCreateResponseSchema,
    );
  }

  update$(
    id: string,
    updates: Partial<BudgetTemplateCreate>,
  ): Observable<BudgetTemplateResponse> {
    return this.#api.patch$(
      `/budget-templates/${id}`,
      updates,
      budgetTemplateResponseSchema,
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
