import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  type TransactionCreate,
  type TransactionUpdate,
  type TransactionCreateResponse,
  type TransactionUpdateResponse,
  type TransactionFindOneResponse,
  type TransactionListResponse,
} from '@pulpe/shared';
import { type Observable } from 'rxjs';
import { ApplicationConfiguration } from '../config/application-configuration';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi {
  readonly #http = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/transactions`;
  }

  findByBudget$(budgetId: string): Observable<TransactionListResponse> {
    return this.#http.get<TransactionListResponse>(
      `${this.#apiUrl}/budget/${budgetId}`,
    );
  }

  create$(
    transaction: TransactionCreate,
  ): Observable<TransactionCreateResponse> {
    return this.#http.post<TransactionCreateResponse>(
      this.#apiUrl,
      transaction,
    );
  }

  findOne$(id: string): Observable<TransactionFindOneResponse> {
    return this.#http.get<TransactionFindOneResponse>(`${this.#apiUrl}/${id}`);
  }

  update$(
    id: string,
    transaction: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    return this.#http.patch<TransactionUpdateResponse>(
      `${this.#apiUrl}/${id}`,
      transaction,
    );
  }

  remove$(id: string): Observable<void> {
    return this.#http.delete<void>(`${this.#apiUrl}/${id}`);
  }
}
