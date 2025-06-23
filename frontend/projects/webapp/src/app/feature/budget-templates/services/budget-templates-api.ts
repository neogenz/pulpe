import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  type BudgetTemplateCreate,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse,
  type TemplateTransactionListResponse,
} from '@pulpe/shared';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class BudgetTemplatesApi {
  #http = inject(HttpClient);
  #apiUrl = `${environment.backendUrl}/budget-templates`;

  getAll$(): Observable<BudgetTemplateListResponse> {
    return this.#http.get<BudgetTemplateListResponse>(this.#apiUrl);
  }

  getById$(id: string): Observable<BudgetTemplateResponse> {
    return this.#http.get<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`);
  }

  create$(template: BudgetTemplateCreate): Observable<BudgetTemplateResponse> {
    return this.#http.post<BudgetTemplateResponse>(this.#apiUrl, template);
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
  ): Observable<TemplateTransactionListResponse> {
    return this.#http.get<TemplateTransactionListResponse>(
      `${this.#apiUrl}/${templateId}/transactions`,
    );
  }

  delete$(id: string): Observable<BudgetTemplateDeleteResponse> {
    return this.#http.delete<BudgetTemplateDeleteResponse>(
      `${this.#apiUrl}/${id}`,
    );
  }
}
