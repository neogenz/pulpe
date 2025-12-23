import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, catchError, throwError } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLineWithConsumptionListResponse,
  type TransactionListResponse,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';

@Injectable()
export class BudgetLineApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);
  #logger = inject(Logger);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-lines`;
  }

  get #budgetApiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budgets`;
  }

  getBudgetLines$(budgetId: string): Observable<BudgetLineListResponse> {
    return this.#http
      .get<BudgetLineListResponse>(`${this.#apiUrl}/budget/${budgetId}`)
      .pipe(
        catchError((error) => {
          this.#logger.error('Error fetching budget lines:', error);
          return throwError(
            () => new Error('Impossible de charger les prévisions'),
          );
        }),
      );
  }

  createBudgetLine$(
    budgetLine: BudgetLineCreate,
  ): Observable<BudgetLineResponse> {
    return this.#http.post<BudgetLineResponse>(this.#apiUrl, budgetLine).pipe(
      catchError((error) => {
        this.#logger.error('Error creating budget line:', error);
        return throwError(() => new Error('Impossible de créer la prévision'));
      }),
    );
  }

  updateBudgetLine$(
    id: string,
    update: BudgetLineUpdate,
  ): Observable<BudgetLineResponse> {
    return this.#http
      .patch<BudgetLineResponse>(`${this.#apiUrl}/${id}`, update)
      .pipe(
        catchError((error) => {
          this.#logger.error('Error updating budget line:', error);
          return throwError(
            () => new Error('Impossible de mettre à jour la prévision'),
          );
        }),
      );
  }

  deleteBudgetLine$(id: string): Observable<BudgetLineDeleteResponse> {
    return this.#http
      .delete<BudgetLineDeleteResponse>(`${this.#apiUrl}/${id}`)
      .pipe(
        catchError((error) => {
          this.#logger.error('Error deleting budget line:', error);
          return throwError(
            () => new Error('Impossible de supprimer la prévision'),
          );
        }),
      );
  }

  /**
   * Get budget lines with consumption data (consumedAmount, remainingAmount)
   * Uses the enriched endpoint GET /budgets/:id/lines
   */
  getBudgetLinesWithConsumption$(
    budgetId: string,
  ): Observable<BudgetLineWithConsumptionListResponse> {
    return this.#http
      .get<BudgetLineWithConsumptionListResponse>(
        `${this.#budgetApiUrl}/${budgetId}/lines`,
      )
      .pipe(
        catchError((error) => {
          this.#logger.error(
            'Error fetching budget lines with consumption:',
            error,
          );
          return throwError(
            () => new Error('Impossible de charger les prévisions enrichies'),
          );
        }),
      );
  }

  /**
   * Get transactions allocated to a specific budget line
   * Uses endpoint GET /budget-lines/:id/transactions
   * Returns transactions sorted by date DESC
   */
  getAllocatedTransactions$(
    budgetLineId: string,
  ): Observable<TransactionListResponse> {
    return this.#http
      .get<TransactionListResponse>(
        `${this.#apiUrl}/${budgetLineId}/transactions`,
      )
      .pipe(
        catchError((error) => {
          this.#logger.error('Error fetching allocated transactions:', error);
          return throwError(
            () => new Error('Impossible de charger les transactions allouées'),
          );
        }),
      );
  }
}
