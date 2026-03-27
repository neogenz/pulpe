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
  type BudgetGenerate,
  type BudgetGenerateResponse,
  budgetGenerateResponseSchema,
  budgetListResponseSchema,
  budgetResponseSchema,
  budgetSparseListResponseSchema,
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLineResponse,
  budgetLineResponseSchema,
  type BudgetLineDeleteResponse,
  budgetLineDeleteResponseSchema,
  type Transaction,
  type TransactionCreate,
  type TransactionCreateResponse,
  type TransactionUpdate,
  type TransactionUpdateResponse,
  type TransactionListResponse,
  transactionListResponseSchema,
} from 'pulpe-shared';
import { type Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ApiClient } from '../api/api-client';
import { DataCache } from 'ngx-ziflux';
import { TransactionApi } from '../transaction/transaction-api';

export interface CreateBudgetApiResponse {
  readonly budget: Budget;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetApi {
  readonly #api = inject(ApiClient);
  readonly #transactionApi = inject(TransactionApi);
  readonly cache = new DataCache({
    staleTime: 30_000,
    expireTime: 600_000,
    name: 'budgets',
  });

  getCachedBudgetExists(): { data: boolean; fresh: boolean } | null {
    const listCache = this.cache.get<Budget[]>(['budget', 'list']);
    if (!listCache) return null;
    return { data: listCache.data.length > 0, fresh: listCache.fresh };
  }

  clearCache(): void {
    this.cache.clear();
  }

  createBudget$(
    templateData: BudgetCreate,
  ): Observable<CreateBudgetApiResponse> {
    const validatedRequest = budgetCreateSchema.parse(templateData);
    return this.#api
      .post$('/budgets', validatedRequest, budgetResponseSchema)
      .pipe(map((response) => ({ budget: response.data })));
  }

  generateBudgets$(data: BudgetGenerate): Observable<BudgetGenerateResponse> {
    return this.#api.post$(
      '/budgets/generate',
      data,
      budgetGenerateResponseSchema,
    );
  }

  getAllBudgets$(): Observable<Budget[]> {
    return this.#api.get$('/budgets', budgetListResponseSchema).pipe(
      map((response) => response.data),
      map((budgets) =>
        budgets.toSorted((a, b) => {
          if (a.year !== b.year) return a.year - b.year;
          return a.month - b.month;
        }),
      ),
    );
  }

  checkBudgetExists$(): Observable<boolean> {
    return this.#api
      .get$('/budgets/exists', budgetExistsResponseSchema)
      .pipe(map((response) => response.hasBudget));
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

    if (Number.isNaN(monthNumber) || Number.isNaN(yearNumber)) {
      return of(null);
    }

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

  getDashboardData$(
    month: string,
    year: string,
  ): Observable<{
    budget: Budget | null;
    transactions: Transaction[];
    budgetLines: BudgetLine[];
  }> {
    return this.getBudgetForMonth$(month, year).pipe(
      switchMap((budget) => {
        if (!budget) {
          return of({
            budget: null,
            transactions: [] as Transaction[],
            budgetLines: [] as BudgetLine[],
          });
        }

        return this.getBudgetWithDetails$(budget.id).pipe(
          map((response) => ({
            budget: response.data.budget,
            transactions: response.data.transactions,
            budgetLines: response.data.budgetLines,
          })),
        );
      }),
    );
  }

  getHistoryData$(): Observable<
    {
      id: string;
      month: number;
      year: number;
      income: number;
      expenses: number;
      savings: number;
    }[]
  > {
    return this.#api
      .get$(
        '/budgets?fields=month,year,totalIncome,totalExpenses,totalSavings&limit=24',
        budgetSparseListResponseSchema,
      )
      .pipe(
        map((response) =>
          response.data
            .filter(
              (b): b is typeof b & { month: number; year: number } =>
                b.month != null && b.year != null,
            )
            .map((b) => ({
              id: b.id,
              month: b.month,
              year: b.year,
              income: b.totalIncome ?? 0,
              expenses: b.totalExpenses ?? 0,
              savings: b.totalSavings ?? 0,
            })),
        ),
      );
  }

  exportAllBudgets$(): Observable<BudgetExportResponse> {
    return this.#api.get$('/budgets/export', budgetExportResponseSchema);
  }

  createBudgetLine$(data: BudgetLineCreate): Observable<BudgetLineResponse> {
    return this.#api.post$('/budget-lines', data, budgetLineResponseSchema);
  }

  updateBudgetLine$(
    id: string,
    data: BudgetLineUpdate,
  ): Observable<BudgetLineResponse> {
    return this.#api.patch$(
      `/budget-lines/${id}`,
      data,
      budgetLineResponseSchema,
    );
  }

  deleteBudgetLine$(id: string): Observable<BudgetLineDeleteResponse> {
    return this.#api.delete$(
      `/budget-lines/${id}`,
      budgetLineDeleteResponseSchema,
    );
  }

  resetBudgetLineFromTemplate$(id: string): Observable<BudgetLineResponse> {
    return this.#api.post$(
      `/budget-lines/${id}/reset-from-template`,
      {},
      budgetLineResponseSchema,
    );
  }

  toggleBudgetLineCheck$(budgetLineId: string): Observable<BudgetLineResponse> {
    return this.#api.post$(
      `/budget-lines/${budgetLineId}/toggle-check`,
      {},
      budgetLineResponseSchema,
    );
  }

  checkBudgetLineTransactions$(
    budgetLineId: string,
  ): Observable<TransactionListResponse> {
    return this.#api.post$(
      `/budget-lines/${budgetLineId}/check-transactions`,
      {},
      transactionListResponseSchema,
    );
  }

  createTransaction$(
    data: TransactionCreate,
  ): Observable<TransactionCreateResponse> {
    return this.#transactionApi.create$(data);
  }

  updateTransaction$(
    id: string,
    data: TransactionUpdate,
  ): Observable<TransactionUpdateResponse> {
    return this.#transactionApi.update$(id, data);
  }

  deleteTransaction$(id: string): Observable<void> {
    return this.#transactionApi.remove$(id);
  }

  toggleTransactionCheck$(id: string): Observable<TransactionUpdateResponse> {
    return this.#transactionApi.toggleCheck$(id);
  }
}
