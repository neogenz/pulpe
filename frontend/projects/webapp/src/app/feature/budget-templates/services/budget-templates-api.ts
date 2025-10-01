import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, forkJoin, map } from 'rxjs';
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
} from '@pulpe/shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';

@Injectable()
export class BudgetTemplatesApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-templates`;
  }

  getAll$(): Observable<BudgetTemplateListResponse> {
    return this.#http.get<BudgetTemplateListResponse>(this.#apiUrl);
  }

  getById$(id: string): Observable<BudgetTemplateResponse> {
    return this.#http.get<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`);
  }

  create$(template: BudgetTemplateCreate): Observable<BudgetTemplateResponse> {
    return this.#http.post<BudgetTemplateResponse>(this.#apiUrl, template);
  }

  createFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): Observable<BudgetTemplateCreateResponse> {
    return this.#http.post<BudgetTemplateCreateResponse>(
      `${this.#apiUrl}/from-onboarding`,
      onboardingData,
    );
  }

  update$(
    id: string,
    updates: Partial<BudgetTemplateCreate>,
  ): Observable<BudgetTemplateResponse> {
    return this.#http.patch<BudgetTemplateResponse>(
      `${this.#apiUrl}/${id}`,
      updates,
    );
  }

  getTemplateTransactions$(
    templateId: string,
  ): Observable<TemplateLineListResponse> {
    return this.#http.get<TemplateLineListResponse>(
      `${this.#apiUrl}/${templateId}/lines`,
    );
  }

  updateTemplateLines$(
    templateId: string,
    bulkUpdate: TemplateLinesBulkUpdate,
  ): Observable<TemplateLinesBulkUpdateResponse> {
    return this.#http.patch<TemplateLinesBulkUpdateResponse>(
      `${this.#apiUrl}/${templateId}/lines`,
      bulkUpdate,
    );
  }

  bulkOperationsTemplateLines$(
    templateId: string,
    bulkOperations: TemplateLinesBulkOperations,
  ): Observable<TemplateLinesBulkOperationsResponse> {
    return this.#http.post<TemplateLinesBulkOperationsResponse>(
      `${this.#apiUrl}/${templateId}/lines/bulk-operations`,
      bulkOperations,
    );
  }

  delete$(id: string): Observable<BudgetTemplateDeleteResponse> {
    return this.#http.delete<BudgetTemplateDeleteResponse>(
      `${this.#apiUrl}/${id}`,
    );
  }

  checkUsage$(id: string): Observable<TemplateUsageResponse> {
    return this.#http.get<TemplateUsageResponse>(`${this.#apiUrl}/${id}/usage`);
  }

  /**
   * Fetches a template and its associated transactions in a single call for
   * the frontend. It first retrieves the template by its identifier and then
   * its transactions, finally mapping the responses to a strict view-model.
   *
   * Optimized for signal resource usage with proper error handling.
   */
  getDetail$(id: string): Observable<BudgetTemplateDetailViewModel> {
    return forkJoin({
      template: this.getById$(id).pipe(map((r) => r.data)),
      transactions: this.getTemplateTransactions$(id).pipe(map((r) => r.data)),
    }).pipe(
      map((result) => {
        // Ensure data consistency and provide fallbacks
        if (!result.template) {
          throw new Error(`Template with id ${id} not found`);
        }
        return {
          template: result.template,
          transactions: result.transactions || [],
        };
      }),
    );
  }
}

// View-model returned to the frontend when requesting a template with its
// associated transactions.
export interface BudgetTemplateDetailViewModel {
  template: BudgetTemplateResponse['data'];
  transactions: TemplateLineListResponse['data'];
}
