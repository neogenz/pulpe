import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import {
  type TransactionCreate,
  type TransactionCreateResponse,
  type TransactionFindOneResponse,
  type TransactionListResponse,
  type TransactionPostponeResponse,
  type TransactionSearchQuery,
  type TransactionSearchResponse,
  type TransactionUpdate,
  type TransactionUpdateResponse,
  transactionCreateSchema,
  transactionListResponseSchema,
  transactionPostponeResponseSchema,
  transactionResponseSchema,
  transactionSearchResponseSchema,
  transactionUpdateSchema,
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
      transactionCreateSchema,
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
      transactionUpdateSchema,
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

  postpone$(id: string): Observable<TransactionPostponeResponse> {
    return this.#api.post$(
      `/transactions/${id}/postpone`,
      {},
      transactionPostponeResponseSchema,
    );
  }

  search$(
    filters: TransactionSearchQuery,
  ): Observable<TransactionSearchResponse> {
    let params = new HttpParams();
    if (filters.q) params = params.set('q', filters.q);
    for (const year of filters.years ?? []) {
      params = params.append('years', year.toString());
    }
    for (const tagId of filters.tagIds ?? []) {
      params = params.append('tagIds', tagId);
    }
    return this.#api.get$(
      `/transactions/search?${params.toString()}`,
      transactionSearchResponseSchema,
    );
  }
}
