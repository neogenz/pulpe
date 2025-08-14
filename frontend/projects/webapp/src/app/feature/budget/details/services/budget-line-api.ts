import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
  type BudgetDetailsResponse,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '../../../../core/config/application-configuration';
import { Logger } from '../../../../core/services/logger';

@Injectable()
export class BudgetLineApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);
  #logger = inject(Logger);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-lines`;
  }

  get #budgetsUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budgets`;
  }

  getBudgetDetails$(budgetId: string): Observable<BudgetDetailsResponse> {
    return this.#http
      .get<BudgetDetailsResponse>(`${this.#budgetsUrl}/${budgetId}/details`)
      .pipe(
        catchError((error) => {
          this.#logger.error('Error fetching budget details:', error);
          return throwError(
            () => new Error('Impossible de charger les détails du budget'),
          );
        }),
      );
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
}
