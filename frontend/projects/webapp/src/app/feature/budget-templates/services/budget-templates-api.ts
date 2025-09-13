import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, forkJoin, map, of } from 'rxjs';
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
import { DemoModeService } from '@core/demo/demo-mode.service';
import { DemoStorageAdapter } from '@core/demo/demo-storage-adapter';

@Injectable()
export class BudgetTemplatesApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);
  #demoMode = inject(DemoModeService);
  #demoStorage = inject(DemoStorageAdapter);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-templates`;
  }

  getAll$(): Observable<BudgetTemplateListResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.getAllTemplates$();
    }
    return this.#http.get<BudgetTemplateListResponse>(this.#apiUrl);
  }

  getById$(id: string): Observable<BudgetTemplateResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.getTemplateById$(id);
    }
    return this.#http.get<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`);
  }

  create$(template: BudgetTemplateCreate): Observable<BudgetTemplateResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.createTemplate$(template);
    }
    return this.#http.post<BudgetTemplateResponse>(this.#apiUrl, template);
  }

  createFromOnboarding$(
    onboardingData: BudgetTemplateCreateFromOnboarding,
  ): Observable<BudgetTemplateCreateResponse> {
    if (this.#demoMode.isDemoMode()) {
      // En mode démo, on peut créer un template basique
      const template: BudgetTemplateCreate = {
        name: 'Nouveau modèle',
        description: 'Créé depuis onboarding',
        isDefault: false,
      };
      return this.#demoStorage.createTemplate$(template).pipe(
        map((response) => ({
          success: true,
          data: response.data,
          templateLineIds: [],
        })),
      );
    }
    return this.#http.post<BudgetTemplateCreateResponse>(
      `${this.#apiUrl}/from-onboarding`,
      onboardingData,
    );
  }

  update$(
    id: string,
    updates: Partial<BudgetTemplateCreate>,
  ): Observable<BudgetTemplateResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.updateTemplate$(id, updates);
    }
    return this.#http.patch<BudgetTemplateResponse>(
      `${this.#apiUrl}/${id}`,
      updates,
    );
  }

  getTemplateTransactions$(
    templateId: string,
  ): Observable<TemplateLineListResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.getTemplateLines$(templateId);
    }
    return this.#http.get<TemplateLineListResponse>(
      `${this.#apiUrl}/${templateId}/lines`,
    );
  }

  updateTemplateLines$(
    templateId: string,
    bulkUpdate: TemplateLinesBulkUpdate,
  ): Observable<TemplateLinesBulkUpdateResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.updateTemplateLines$(templateId, bulkUpdate);
    }
    return this.#http.patch<TemplateLinesBulkUpdateResponse>(
      `${this.#apiUrl}/${templateId}/lines`,
      bulkUpdate,
    );
  }

  bulkOperationsTemplateLines$(
    templateId: string,
    bulkOperations: TemplateLinesBulkOperations,
  ): Observable<TemplateLinesBulkOperationsResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.bulkOperationsTemplateLines$(
        templateId,
        bulkOperations,
      );
    }
    return this.#http.post<TemplateLinesBulkOperationsResponse>(
      `${this.#apiUrl}/${templateId}/lines/bulk-operations`,
      bulkOperations,
    );
  }

  delete$(id: string): Observable<BudgetTemplateDeleteResponse> {
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.deleteTemplate$(id);
    }
    return this.#http.delete<BudgetTemplateDeleteResponse>(
      `${this.#apiUrl}/${id}`,
    );
  }

  checkUsage$(id: string): Observable<TemplateUsageResponse> {
    if (this.#demoMode.isDemoMode()) {
      // En mode démo, on peut simuler une réponse
      const budgets = this.#demoMode.getDemoData<any[]>('budgets') || [];
      const usedInBudgets = budgets.filter((b) => b.templateId === id).length;
      return of({
        success: true,
        data: {
          templateId: id,
          usedInBudgets,
          canDelete: usedInBudgets === 0,
        },
      });
    }
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
