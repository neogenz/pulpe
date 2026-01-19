import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { type Observable, catchError, throwError } from 'rxjs';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
} from 'pulpe-shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';

@Injectable()
export class BudgetLineApi {
  readonly #http = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);

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

  resetFromTemplate$(id: string): Observable<BudgetLineResponse> {
    return this.#http
      .post<BudgetLineResponse>(`${this.#apiUrl}/${id}/reset-from-template`, {})
      .pipe(
        catchError((error) => {
          this.#logger.error(
            'Error resetting budget line from template:',
            error,
          );
          const isNotFound =
            error instanceof HttpErrorResponse && error.status === 404;
          return throwError(
            () =>
              new Error(
                isNotFound
                  ? 'Le modèle a été supprimé'
                  : 'Impossible de réinitialiser la prévision',
              ),
          );
        }),
      );
  }

  toggleCheck$(id: string): Observable<BudgetLineResponse> {
    return this.#http
      .post<BudgetLineResponse>(`${this.#apiUrl}/${id}/toggle-check`, {})
      .pipe(
        catchError((error) => {
          this.#logger.error('Error toggling budget line check:', error);
          return throwError(
            () => new Error('Impossible de basculer le statut de la prévision'),
          );
        }),
      );
  }
}
