import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  type TransactionCreate,
  type TransactionCreateResponse,
  type TransactionFindOneResponse,
  type TransactionListResponse,
  type TransactionUpdate,
  type TransactionUpdateResponse,
  transactionListResponseSchema,
  transactionResponseSchema,
} from '@pulpe/shared';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
    return this.#http
      .get<unknown>(`${this.#apiUrl}/budget/${budgetId}`)
      .pipe(map((response) => transactionListResponseSchema.parse(response)));
  }

  create$(
    transaction: TransactionCreate,
  ): Observable<TransactionCreateResponse> {
    return this.#http
      .post<unknown>(this.#apiUrl, transaction)
      .pipe(map((response) => transactionResponseSchema.parse(response)));
  }

  findOne$(id: string): Observable<TransactionFindOneResponse> {
    return this.#http
      .get<unknown>(`${this.#apiUrl}/${id}`)
      .pipe(map((response) => transactionResponseSchema.parse(response)));
  }

  update$(
    id: string,
    transaction: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    return this.#http
      .patch<unknown>(`${this.#apiUrl}/${id}`, transaction)
      .pipe(map((response) => transactionResponseSchema.parse(response)));
  }

  remove$(id: string): Observable<void> {
    return this.#http.delete<void>(`${this.#apiUrl}/${id}`);
  }

  toggleCheck$(id: string): Observable<TransactionUpdateResponse> {
    return this.#http.post<TransactionUpdateResponse>(
      `${this.#apiUrl}/${id}/toggle-check`,
      {},
    );
  }
}
