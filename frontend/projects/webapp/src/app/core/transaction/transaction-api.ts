import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  type TransactionCreateRequest,
  type TransactionResponse,
  type TransactionUpdateRequest,
} from '@pulpe/shared';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.backendUrl}/transactions`;

  findByBudget$(budgetId: string): Observable<TransactionResponse> {
    return this.http.get<TransactionResponse>(
      `${this.apiUrl}/budget/${budgetId}`,
    );
  }

  create$(
    transaction: TransactionCreateRequest,
  ): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(this.apiUrl, transaction);
  }

  findOne$(id: string): Observable<TransactionResponse> {
    return this.http.get<TransactionResponse>(`${this.apiUrl}/${id}`);
  }

  update$(
    id: string,
    transaction: TransactionUpdateRequest,
  ): Observable<TransactionResponse> {
    return this.http.put<TransactionResponse>(
      `${this.apiUrl}/${id}`,
      transaction,
    );
  }

  remove$(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
