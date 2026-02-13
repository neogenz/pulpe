import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
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
    let params = new HttpParams().set('q', query);
    if (years?.length) {
      for (const y of years) {
        params = params.append('years', y.toString());
      }
    }
    return this.#api.get$(
      `/transactions/search?${params.toString()}`,
      transactionSearchResponseSchema,
    );
  }
}
