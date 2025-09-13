import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { type Observable, catchError, throwError, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type BudgetLineResponse,
  type BudgetLineListResponse,
  type BudgetLineDeleteResponse,
  type BudgetLineCreate,
  type BudgetLineUpdate,
} from '@pulpe/shared';
import { ApplicationConfiguration } from '@core/config/application-configuration';
import { Logger } from '@core/logging/logger';
import { DemoModeService } from '@core/demo/demo-mode.service';
import { DemoStorageAdapter } from '@core/demo/demo-storage-adapter';

@Injectable()
export class BudgetLineApi {
  #http = inject(HttpClient);
  #applicationConfig = inject(ApplicationConfiguration);
  #logger = inject(Logger);
  #demoMode = inject(DemoModeService);
  #demoStorage = inject(DemoStorageAdapter);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budget-lines`;
  }

  getBudgetLines$(budgetId: string): Observable<BudgetLineListResponse> {
    // Si en mode démo, récupérer depuis localStorage
    if (this.#demoMode.isDemoMode()) {
      const budgetLines =
        this.#demoMode.getDemoData<any[]>('budget-lines') || [];
      const filteredLines = budgetLines.filter(
        (bl) => bl.budgetId === budgetId,
      );
      return of({ success: true, data: filteredLines, message: 'OK' });
    }

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
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.createBudgetLine$(budgetLine).pipe(
        catchError((error) => {
          this.#logger.error('Error creating budget line:', error);
          return throwError(
            () => new Error('Impossible de créer la prévision'),
          );
        }),
      );
    }

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
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.updateBudgetLine$(id, update).pipe(
        catchError((error) => {
          this.#logger.error('Error updating budget line:', error);
          return throwError(
            () => new Error('Impossible de mettre à jour la prévision'),
          );
        }),
      );
    }

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
    // Si en mode démo, utiliser le DemoStorageAdapter
    if (this.#demoMode.isDemoMode()) {
      return this.#demoStorage.deleteBudgetLine$(id).pipe(
        map(() => ({
          success: true as const,
          message: 'Prévision supprimée avec succès',
        })),
        catchError((error) => {
          this.#logger.error('Error deleting budget line:', error);
          return throwError(
            () => new Error('Impossible de supprimer la prévision'),
          );
        }),
      );
    }

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
