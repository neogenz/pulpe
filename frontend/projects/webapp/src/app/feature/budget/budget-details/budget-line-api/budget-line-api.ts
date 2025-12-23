import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, catchError, throwError } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetLineWithTransactionsListResponse,
  type AllocatedTransactionsListResponse,
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

  getAllocatedTransactions$(
    budgetLineId: string,
  ): Observable<AllocatedTransactionsListResponse> {
    return this.#http
      .get<AllocatedTransactionsListResponse>(
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

  getBudgetLinesWithTransactions$(
    budgetId: string,
  ): Observable<BudgetLineWithTransactionsListResponse> {
    return this.#http
      .get<BudgetLineWithTransactionsListResponse>(
        `${this.#apiUrl}/budget/${budgetId}/with-transactions`,
      )
      .pipe(
        catchError((error) => {
          this.#logger.error(
            'Error fetching budget lines with transactions:',
            error,
          );
          return throwError(
            () =>
              new Error(
                'Impossible de charger les prévisions avec transactions',
              ),
          );
        }),
      );
  }
}
