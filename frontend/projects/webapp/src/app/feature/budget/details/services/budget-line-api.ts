import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';

@Injectable()
export class BudgetLineApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-lines`;
  }

  get #budgetsUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budgets`;
  }

  getBudgetDetails$(budgetId: string): Observable<BudgetDetailsResponse> {
    return this.#http.get<BudgetDetailsResponse>(
      `${this.#budgetsUrl}/${budgetId}/details`,
    );
  }

  getBudgetLines$(budgetId: string): Observable<BudgetLineListResponse> {
    return this.#http.get<BudgetLineListResponse>(
      `${this.#apiUrl}/budget/${budgetId}`,
    );
  }

  createBudgetLine$(
    budgetLine: BudgetLineCreate,
  ): Observable<BudgetLineResponse> {
    return this.#http.post<BudgetLineResponse>(this.#apiUrl, budgetLine);
  }

  updateBudgetLine$(
    id: string,
    update: BudgetLineUpdate,
  ): Observable<BudgetLineResponse> {
    return this.#http.patch<BudgetLineResponse>(
      `${this.#apiUrl}/${id}`,
      update,
    );
  }

  deleteBudgetLine$(id: string): Observable<BudgetLineDeleteResponse> {
    return this.#http.delete<BudgetLineDeleteResponse>(`${this.#apiUrl}/${id}`);
  }
}
