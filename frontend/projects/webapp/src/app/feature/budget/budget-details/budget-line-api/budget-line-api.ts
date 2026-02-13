import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type TransactionListResponse,
  budgetLineResponseSchema,
  budgetLineListResponseSchema,
  deleteResponseSchema,
  transactionListResponseSchema,
} from 'pulpe-shared';
import { ApiClient } from '@core/api/api-client';

@Injectable()
export class BudgetLineApi {
  readonly #api = inject(ApiClient);

  getBudgetLines$(budgetId: string): Observable<BudgetLineListResponse> {
    return this.#api.get$(
      `/budget-lines/budget/${budgetId}`,
      budgetLineListResponseSchema,
    );
  }

  createBudgetLine$(
    budgetLine: BudgetLineCreate,
  ): Observable<BudgetLineResponse> {
    return this.#api.post$(
      '/budget-lines',
      budgetLine,
      budgetLineResponseSchema,
    );
  }

  updateBudgetLine$(
    id: string,
    update: BudgetLineUpdate,
  ): Observable<BudgetLineResponse> {
    return this.#api.patch$(
      `/budget-lines/${id}`,
      update,
      budgetLineResponseSchema,
    );
  }

  deleteBudgetLine$(id: string): Observable<BudgetLineDeleteResponse> {
    return this.#api.delete$(`/budget-lines/${id}`, deleteResponseSchema);
  }

  resetFromTemplate$(id: string): Observable<BudgetLineResponse> {
    return this.#api.post$(
      `/budget-lines/${id}/reset-from-template`,
      {},
      budgetLineResponseSchema,
    );
  }

  toggleCheck$(id: string): Observable<BudgetLineResponse> {
    return this.#api.post$(
      `/budget-lines/${id}/toggle-check`,
      {},
      budgetLineResponseSchema,
    );
  }

  checkTransactions$(
    budgetLineId: string,
  ): Observable<TransactionListResponse> {
    return this.#api.post$(
      `/budget-lines/${budgetLineId}/check-transactions`,
      {},
      transactionListResponseSchema,
    );
  }
}
