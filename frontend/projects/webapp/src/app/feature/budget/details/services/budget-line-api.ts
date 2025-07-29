import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';
import { environment } from '../../../../../environments/environment';

@Injectable()
export class BudgetLineApi {
  #http = inject(HttpClient);
  #apiUrl = `${environment.backendUrl}/budget-lines`;
  #budgetsUrl = `${environment.backendUrl}/budgets`;

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
