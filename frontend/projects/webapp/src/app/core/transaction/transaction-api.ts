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
import { Observable } from 'rxjs';
import { ApplicationConfiguration } from '../config/application-configuration';
import { DemoModeService } from '../demo/demo-mode.service';
import { DemoStorageAdapter } from '../demo/demo-storage-adapter';

@Injectable({
  providedIn: 'root',
})
export class TransactionApi {
  readonly #http = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #demoMode = inject(DemoModeService);
  readonly #demoStorage = inject(DemoStorageAdapter);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/transactions`;
  }

  findByBudget$(budgetId: string): Observable<TransactionListResponse> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.getTransactionsByBudget$(budgetId);
    }

    return this.#http.get<TransactionListResponse>(
      `${this.#apiUrl}/budget/${budgetId}`,
    );
  }

  create$(
    transaction: TransactionCreate,
  ): Observable<TransactionCreateResponse> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.createTransaction$(transaction);
    }

    return this.#http.post<TransactionCreateResponse>(
      this.#apiUrl,
      transaction,
    );
  }

  findOne$(id: string): Observable<TransactionFindOneResponse> {
    // Si en mode démo, utiliser le DemoStorageAdapter pour récupérer depuis localStorage
    if (this.#demoMode.isDemoMode()) {
      const transactions =
        this.#demoMode.getDemoData<any[]>('transactions') || [];
      const transaction = transactions.find((t) => t.id === id);

      if (!transaction) {
        throw new Error('Transaction non trouvée');
      }

      return new Observable((observer) => {
        observer.next({ success: true, data: transaction });
        observer.complete();
      });
    }

    return this.#http.get<TransactionFindOneResponse>(`${this.#apiUrl}/${id}`);
  }

  update$(
    id: string,
    transaction: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.updateTransaction$(id, transaction);
    }

    return this.#http.patch<TransactionUpdateResponse>(
      `${this.#apiUrl}/${id}`,
      transaction,
    );
  }

  remove$(id: string): Observable<void> {
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.deleteTransaction$(id);
    }

    return this.#http.delete<void>(`${this.#apiUrl}/${id}`);
  }
}
