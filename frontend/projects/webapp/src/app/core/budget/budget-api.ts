import { inject, Injectable } from '@angular/core';
import {
  type Budget,
  type BudgetCreate,
  budgetCreateSchema,
  type BudgetDetailsResponse,
  budgetDetailsResponseSchema,
  budgetExistsResponseSchema,
  type BudgetExportResponse,
  budgetExportResponseSchema,
  budgetListResponseSchema,
  budgetResponseSchema,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLineResponse,
  budgetLineResponseSchema,
  type BudgetLineDeleteResponse,
  budgetLineDeleteResponseSchema,
  type TransactionCreate,
  type TransactionCreateResponse,
  type TransactionUpdate,
  type TransactionUpdateResponse,
  type TransactionListResponse,
  transactionListResponseSchema,
} from 'pulpe-shared';
import { type Observable, firstValueFrom, from, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { HasBudgetCache } from '../auth/has-budget-cache';
import { DataCache } from '../cache/data-cache';
import { TransactionApi } from '../transaction/transaction-api';
import { BudgetInvalidationService } from './budget-invalidation.service';

export interface CreateBudgetApiResponse {
  readonly budget: Budget;
  readonly message: string;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetApi {
  readonly #api = inject(ApiClient);
  readonly #hasBudgetCache = inject(HasBudgetCache);
  readonly #invalidationService = inject(BudgetInvalidationService);
  readonly #transactionApi = inject(TransactionApi);
  readonly cache = new DataCache({ freshTime: 30_000, gcTime: 600_000 });

  createBudget$(
    templateData: BudgetCreate,
  ): Observable<CreateBudgetApiResponse> {
    const validatedRequest = budgetCreateSchema.parse(templateData);
    return this.#api
      .post$('/budgets', validatedRequest, budgetResponseSchema)
      .pipe(
        tap(() => {
          this.#hasBudgetCache.setHasBudget(true);
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
        map((response) => ({
          budget: response.data,
          message: 'Budget créé avec succès à partir du template',
        })),
      );
  }

  getAllBudgets$(): Observable<Budget[]> {
    const cacheKey: string[] = ['budget', 'list'];
    const cached = this.cache.get<Budget[]>(cacheKey);

    if (cached?.fresh) {
      return of(cached.data);
    }

    return from(
      this.cache.deduplicate(cacheKey, async () => {
        const response = await firstValueFrom(
          this.#api.get$('/budgets', budgetListResponseSchema),
        );
        this.#hasBudgetCache.setHasBudget(response.data.length > 0);
        this.cache.set(cacheKey, response.data);
        return response.data;
      }),
    );
  }

  checkBudgetExists$(): Observable<boolean> {
    const cacheKey: string[] = ['budget', 'exists'];
    const cached = this.cache.get<boolean>(cacheKey);

    if (cached?.fresh) {
      return of(cached.data);
    }

    return from(
      this.cache.deduplicate(cacheKey, async () => {
        const response = await firstValueFrom(
          this.#api.get$('/budgets/exists', budgetExistsResponseSchema),
        );
        this.#hasBudgetCache.setHasBudget(response.hasBudget);
        this.cache.set(cacheKey, response.hasBudget);
        return response.hasBudget;
      }),
    );
  }

  getBudgetById$(budgetId: string): Observable<Budget> {
    return this.#api
      .get$(`/budgets/${budgetId}`, budgetResponseSchema)
      .pipe(map((response) => response.data));
  }

  getBudgetWithDetails$(budgetId: string): Observable<BudgetDetailsResponse> {
    return this.#api.get$(
      `/budgets/${budgetId}/details`,
      budgetDetailsResponseSchema,
    );
  }

  getBudgetForMonth$(month: string, year: string): Observable<Budget | null> {
    const monthNumber = parseInt(month, 10);
    const yearNumber = parseInt(year, 10);
    return this.getAllBudgets$().pipe(
      map(
        (budgets) =>
          budgets.find(
            (budget) =>
              budget.month === monthNumber && budget.year === yearNumber,
          ) ?? null,
      ),
    );
  }

  updateBudget$(
    budgetId: string,
    updateData: Partial<BudgetCreate>,
  ): Observable<Budget> {
    return this.#api
      .patch$(`/budgets/${budgetId}`, updateData, budgetResponseSchema)
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
        map((response) => response.data),
      );
  }

  deleteBudget$(budgetId: string): Observable<void> {
    return this.#api.deleteVoid$(`/budgets/${budgetId}`).pipe(
      switchMap(() =>
        this.#api.get$('/budgets/exists', budgetExistsResponseSchema),
      ),
      tap((response) => {
        this.#hasBudgetCache.setHasBudget(response.hasBudget);
        this.#invalidationService.invalidate();
        this.cache.invalidate(['budget']);
      }),
      map(() => void 0),
    );
  }

  exportAllBudgets$(): Observable<BudgetExportResponse> {
    return this.#api.get$('/budgets/export', budgetExportResponseSchema);
  }

  createBudgetLine$(data: BudgetLineCreate): Observable<BudgetLineResponse> {
    return this.#api
      .post$('/budget-lines', data, budgetLineResponseSchema)
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
      );
  }

  updateBudgetLine$(
    id: string,
    data: BudgetLineUpdate,
  ): Observable<BudgetLineResponse> {
    return this.#api
      .patch$(`/budget-lines/${id}`, data, budgetLineResponseSchema)
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
      );
  }

  deleteBudgetLine$(id: string): Observable<BudgetLineDeleteResponse> {
    return this.#api
      .delete$(`/budget-lines/${id}`, budgetLineDeleteResponseSchema)
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
      );
  }

  resetBudgetLineFromTemplate$(id: string): Observable<BudgetLineResponse> {
    return this.#api
      .post$(
        `/budget-lines/${id}/reset-from-template`,
        {},
        budgetLineResponseSchema,
      )
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
      );
  }

  toggleBudgetLineCheck$(budgetLineId: string): Observable<BudgetLineResponse> {
    return this.#api
      .post$(
        `/budget-lines/${budgetLineId}/toggle-check`,
        {},
        budgetLineResponseSchema,
      )
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
      );
  }

  checkBudgetLineTransactions$(
    budgetLineId: string,
  ): Observable<TransactionListResponse> {
    return this.#api
      .post$(
        `/budget-lines/${budgetLineId}/check-transactions`,
        {},
        transactionListResponseSchema,
      )
      .pipe(
        tap(() => {
          this.#invalidationService.invalidate();
          this.cache.invalidate(['budget']);
        }),
      );
  }

  createTransaction$(
    data: TransactionCreate,
  ): Observable<TransactionCreateResponse> {
    return this.#transactionApi.create$(data).pipe(
      tap(() => {
        this.#invalidationService.invalidate();
        this.cache.invalidate(['budget']);
      }),
    );
  }

  updateTransaction$(
    id: string,
    data: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    return this.#transactionApi.update$(id, data).pipe(
      tap(() => {
        this.#invalidationService.invalidate();
        this.cache.invalidate(['budget']);
      }),
    );
  }

  deleteTransaction$(id: string): Observable<void> {
    return this.#transactionApi.remove$(id).pipe(
      tap(() => {
        this.#invalidationService.invalidate();
        this.cache.invalidate(['budget']);
      }),
    );
  }

  toggleTransactionCheck$(id: string): Observable<TransactionUpdateResponse> {
    return this.#transactionApi.toggleCheck$(id).pipe(
      tap(() => {
        this.#invalidationService.invalidate();
        this.cache.invalidate(['budget']);
      }),
    );
  }
}
