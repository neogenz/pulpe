import { inject, Injectable } from '@angular/core';
import {
  type TransactionCreate,
  type TransactionCreateResponse,
  type TransactionFindOneResponse,
  type TransactionListResponse,
  type TransactionSearchResponse,
  type TransactionUpdate,
  type TransactionUpdateResponse,
  transactionListResponseSchema,
  transactionResponseSchema,
  transactionSearchResponseSchema,
} from 'pulpe-shared';
import { type Observable } from 'rxjs';
import { ApiClient } from '@core/api/api-client';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi {
  readonly #api = inject(ApiClient);

  findByBudget$(budgetId: string): Observable<TransactionListResponse> {
    return this.#api.get$(
      `/transactions/budget/${budgetId}`,
      transactionListResponseSchema,
    );
  }

  create$(
    transaction: TransactionCreate,
  ): Observable<TransactionCreateResponse> {
    return this.#api.post$(
      '/transactions',
      transaction,
      transactionResponseSchema,
    );
  }

  findOne$(id: string): Observable<TransactionFindOneResponse> {
    return this.#api.get$(`/transactions/${id}`, transactionResponseSchema);
  }

  update$(
    id: string,
    transaction: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    return this.#api.patch$(
      `/transactions/${id}`,
      transaction,
      transactionResponseSchema,
    );
  }

  remove$(id: string): Observable<void> {
    return this.#api.deleteVoid$(`/transactions/${id}`);
  }

  toggleCheck$(id: string): Observable<TransactionUpdateResponse> {
    return this.#api.post$(
      `/transactions/${id}/toggle-check`,
      {},
      transactionResponseSchema,
    );
  }

  search$(
    query: string,
    years?: number[],
  ): Observable<TransactionSearchResponse> {
    let path = `/transactions/search?q=${encodeURIComponent(query)}`;
    if (years?.length) {
      path += years.map((y) => `&years=${y}`).join('');
    }
    return this.#api.get$(path, transactionSearchResponseSchema);
  }
}
