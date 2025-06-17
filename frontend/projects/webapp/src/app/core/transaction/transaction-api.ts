import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  type TransactionCreate,
  type TransactionResponse,
  type TransactionUpdate,
  type TransactionCreateResponse,
  type TransactionUpdateResponse,
  type TransactionFindOneResponse,
  type TransactionListResponse,
} from '@pulpe/shared';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.backendUrl}/transactions`;

  findByBudget$(budgetId: string): Observable<TransactionListResponse> {
    return this.http.get<TransactionListResponse>(
      `${this.apiUrl}/budget/${budgetId}`,
    );
  }

  create$(transaction: TransactionCreate): Observable<TransactionCreateResponse> {
    return this.http.post<TransactionCreateResponse>(this.apiUrl, transaction);
  }

  findOne$(id: string): Observable<TransactionFindOneResponse> {
    return this.http.get<TransactionFindOneResponse>(`${this.apiUrl}/${id}`);
  }

  update$(
    id: string,
    transaction: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    return this.http.put<TransactionUpdateResponse>(
      `${this.apiUrl}/${id}`,
      transaction,
    );
  }

  remove$(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
