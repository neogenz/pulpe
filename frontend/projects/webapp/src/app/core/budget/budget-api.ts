import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type Budget,
  type BudgetCreate,
  budgetCreateSchema,
  type BudgetDetailsResponse,
  budgetDetailsResponseSchema,
  type BudgetExportResponse,
  budgetExportResponseSchema,
  budgetListResponseSchema,
  budgetResponseSchema,
  type ErrorResponse,
  errorResponseSchema,
} from 'pulpe-shared';
import { type Observable, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';
import { HasBudgetCache } from '../auth/has-budget-cache';
import { BudgetInvalidationService } from './budget-invalidation.service';

export interface CreateBudgetApiResponse {
  readonly budget: Budget;
  readonly message: string;
}

export interface BudgetApiError {
  readonly message: string;
  readonly details?: readonly string[];
  readonly code?: string;
}

type NormalizedErrorPayload = Partial<
  Pick<ErrorResponse, 'message' | 'error' | 'code' | 'details'>
>;

@Injectable({
  providedIn: 'root',
})
export class BudgetApi {
  readonly #httpClient = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);
  readonly #logger = inject(Logger);
  readonly #hasBudgetCache = inject(HasBudgetCache);
  readonly #invalidationService = inject(BudgetInvalidationService);

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budgets`;
  }

  /**
   * Crée un budget à partir d'un template
   */
  createBudget$(
    templateData: BudgetCreate,
  ): Observable<CreateBudgetApiResponse> {
    const validatedRequest = budgetCreateSchema.parse(templateData);

    return this.#httpClient
      .post<unknown>(`${this.#apiUrl}`, validatedRequest)
      .pipe(
        map((response) => {
          const validated = budgetResponseSchema.parse(response);
          const result: CreateBudgetApiResponse = {
            budget: validated.data,
            message: 'Budget créé avec succès à partir du template',
          };
          this.#hasBudgetCache.setHasBudget(true);
          this.#invalidationService.invalidate();
          return result;
        }),
        catchError((error) =>
          this.#handleApiError(
            error,
            'Erreur lors de la création du budget à partir du template',
          ),
        ),
      );
  }

  /**
   * Récupère tous les budgets de l'utilisateur
   */
  getAllBudgets$(): Observable<Budget[]> {
    return this.#httpClient.get<unknown>(this.#apiUrl).pipe(
      map((response) => {
        const budgets = budgetListResponseSchema.parse(response).data;
        this.#hasBudgetCache.setHasBudget(budgets.length > 0);
        return budgets;
      }),
      catchError((error) =>
        this.#handleApiError(
          error,
          'Erreur lors de la récupération des budgets',
        ),
      ),
    );
  }

  /**
   * Vérifie si l'utilisateur a au moins un budget (endpoint optimisé).
   * Auto-sync le cache pour les guards et composants.
   */
  checkBudgetExists$(): Observable<boolean> {
    return this.#httpClient
      .get<{ hasBudget: boolean }>(`${this.#apiUrl}/exists`)
      .pipe(
        map((response) => {
          this.#hasBudgetCache.setHasBudget(response.hasBudget);
          return response.hasBudget;
        }),
        catchError((error) =>
          this.#handleApiError(
            error,
            'Erreur lors de la vérification des budgets',
          ),
        ),
      );
  }

  /**
   * Récupère un budget spécifique par ID
   */
  getBudgetById$(budgetId: string): Observable<Budget> {
    return this.#httpClient.get<unknown>(`${this.#apiUrl}/${budgetId}`).pipe(
      map((response) => budgetResponseSchema.parse(response).data),
      catchError((error) =>
        this.#handleApiError(error, 'Erreur lors de la récupération du budget'),
      ),
    );
  }

  /**
   * Récupère un budget avec toutes ses données associées (transactions et lignes budgétaires)
   */
  getBudgetWithDetails$(budgetId: string): Observable<BudgetDetailsResponse> {
    return this.#httpClient
      .get<unknown>(`${this.#apiUrl}/${budgetId}/details`)
      .pipe(
        map((response) => budgetDetailsResponseSchema.parse(response)),
        catchError((error) =>
          this.#handleApiError(
            error,
            'Erreur lors de la récupération des détails du budget',
          ),
        ),
      );
  }

  /**
   * Récupère le budget pour un mois et une année donnés
   * Retourne le modèle business frontend avec des catégories par défaut
   */
  getBudgetForMonth$(month: string, year: string): Observable<Budget | null> {
    const monthNumber = parseInt(month, 10);
    const yearNumber = parseInt(year, 10);

    return this.getAllBudgets$().pipe(
      map((budgets) => {
        const foundBudget = budgets.find(
          (budget) =>
            budget.month === monthNumber && budget.year === yearNumber,
        );

        if (!foundBudget) {
          return null;
        }

        // Adapter le DTO vers le modèle business frontend
        return foundBudget;
      }),
    );
  }

  /**
   * Met à jour un budget existant
   */
  updateBudget$(
    budgetId: string,
    updateData: Partial<BudgetCreate>,
  ): Observable<Budget> {
    return this.#httpClient
      .patch<unknown>(`${this.#apiUrl}/${budgetId}`, updateData)
      .pipe(
        map((response) => {
          const validated = budgetResponseSchema.parse(response);
          this.#invalidationService.invalidate();
          return validated.data;
        }),
        catchError((error) =>
          this.#handleApiError(
            error,
            'Erreur lors de la mise à jour du budget',
          ),
        ),
      );
  }

  /**
   * Supprime un budget et resynchronise le cache HasBudgetCache.
   */
  deleteBudget$(budgetId: string): Observable<void> {
    return this.#httpClient.delete(`${this.#apiUrl}/${budgetId}`).pipe(
      switchMap(() =>
        this.#httpClient.get<{ hasBudget: boolean }>(`${this.#apiUrl}/exists`),
      ),
      map((response) => {
        this.#hasBudgetCache.setHasBudget(response.hasBudget);
        this.#invalidationService.invalidate();
      }),
      catchError((error) =>
        this.#handleApiError(error, 'Erreur lors de la suppression du budget'),
      ),
    );
  }

  /**
   * Récupère tous les budgets avec leurs détails pour export
   */
  exportAllBudgets$(): Observable<BudgetExportResponse> {
    return this.#httpClient.get<unknown>(`${this.#apiUrl}/export`).pipe(
      map((response) => budgetExportResponseSchema.parse(response)),
      catchError((error) =>
        this.#handleApiError(error, "Erreur lors de l'export des budgets"),
      ),
    );
  }

  #getLocalizedErrorMessage(code?: string): string | null {
    if (!code) return null;

    switch (code) {
      case 'ERR_BUDGET_ALREADY_EXISTS':
        return 'Un budget existe déjà pour cette période. Veuillez sélectionner un autre mois.';
      case 'ERR_TEMPLATE_NOT_FOUND':
        return "Le modèle sélectionné n'existe plus. Veuillez en choisir un autre.";
      default:
        return null; // Pas de mapping pour ce code
    }
  }

  #handleApiError(error: unknown, defaultMessage: string): Observable<never> {
    this.#logger.error('Erreur API Budget:', error);

    if (!this.#isHttpError(error)) {
      const message = this.#extractFallbackMessage(error, defaultMessage);
      return throwError(() => ({ message }) satisfies BudgetApiError);
    }

    const rawPayload = error.error;
    const payload = this.#normalizeErrorPayload(rawPayload);
    const fallbackMessage = this.#extractFallbackMessage(error, defaultMessage);

    const message =
      this.#getLocalizedErrorMessage(payload.code) ??
      payload.message ??
      payload.error ??
      (typeof rawPayload === 'string' ? rawPayload : undefined) ??
      fallbackMessage;

    const budgetError: BudgetApiError = {
      message,
      details: this.#normalizeDetails(payload.details),
      code: payload.code,
    };

    return throwError(() => budgetError);
  }

  #isHttpError(error: unknown): error is HttpErrorResponse {
    return error instanceof HttpErrorResponse;
  }

  #extractFallbackMessage(error: unknown, defaultMessage: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return defaultMessage;
  }

  #normalizeErrorPayload(rawPayload: unknown): NormalizedErrorPayload {
    const parsedPayload = errorResponseSchema.safeParse(rawPayload);

    if (parsedPayload.success) {
      return parsedPayload.data;
    }

    this.#logger.warn('Payload erreur API non conforme au schéma partagé', {
      issues: parsedPayload.error.issues,
      payload: rawPayload,
    });

    if (rawPayload && typeof rawPayload === 'object') {
      const payloadRecord = rawPayload as Record<string, unknown>;

      return {
        message:
          typeof payloadRecord['message'] === 'string'
            ? (payloadRecord['message'] as string)
            : undefined,
        error:
          typeof payloadRecord['error'] === 'string'
            ? (payloadRecord['error'] as string)
            : undefined,
        code:
          typeof payloadRecord['code'] === 'string'
            ? (payloadRecord['code'] as string)
            : undefined,
        details: this.#extractDetails(payloadRecord['details']),
      } satisfies NormalizedErrorPayload;
    }

    if (typeof rawPayload === 'string') {
      return { error: rawPayload } satisfies NormalizedErrorPayload;
    }

    return {} satisfies NormalizedErrorPayload;
  }

  #extractDetails(value: unknown): NormalizedErrorPayload['details'] {
    if (typeof value === 'string') {
      return value;
    }

    if (value && typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return undefined;
  }

  #normalizeDetails(
    details: NormalizedErrorPayload['details'],
  ): readonly string[] | undefined {
    if (typeof details === 'string') {
      return [details];
    }

    if (details) {
      return [JSON.stringify(details)];
    }

    return undefined;
  }
}
