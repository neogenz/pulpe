import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
  type BudgetTemplate, 
  type BudgetTemplateCreate,
  type BudgetTemplateListResponse,
  type BudgetTemplateResponse,
  type BudgetTemplateDeleteResponse
} from '@pulpe/shared';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BudgetTemplatesApi {
  #http = inject(HttpClient);
  #apiUrl = `${environment.backendUrl}/budget-templates`;

  getAll$(): Observable<BudgetTemplateListResponse> {
    return this.#http.get<BudgetTemplateListResponse>(this.#apiUrl);
  }

  create$(template: BudgetTemplateCreate): Observable<BudgetTemplateResponse> {
    return this.#http.post<BudgetTemplateResponse>(this.#apiUrl, template);
  }

  update$(id: string, updates: Partial<BudgetTemplateCreate>): Observable<BudgetTemplateResponse> {
    return this.#http.patch<BudgetTemplateResponse>(`${this.#apiUrl}/${id}`, updates);
  }

  delete$(id: string): Observable<BudgetTemplateDeleteResponse> {
    return this.#http.delete<BudgetTemplateDeleteResponse>(`${this.#apiUrl}/${id}`);
  }
}
