import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  type Budget,
  type BudgetCreate,
  budgetCreateSchema,
  type BudgetDetailsResponse,
  type BudgetResponse,
  budgetSchema,
  type ErrorResponse,
  errorResponseSchema,
} from '@pulpe/shared';
import { type Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApplicationConfiguration } from '../config/application-configuration';
import { Logger } from '../logging/logger';

export interface CreateBudgetApiResponse {
  readonly budget: Budget;
  readonly message: string;
}

export interface BudgetApiError {
  readonly message: string;
  readonly details?: readonly string[];
  readonly code?: string;
}

const CURRENT_BUDGET_STORAGE_KEY = 'pulpe-current-budget';

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

  get #apiUrl(): string {
    return `${this.#applicationConfig.backendApiUrl()}/budgets`;
  }

  /**
   * Crée un budget à partir d'un template
   */
  createBudget$(
    templateData: BudgetCreate,
  ): Observable<CreateBudgetApiResponse> {
    // Valider les données avec le schéma partagé
    const validatedRequest = budgetCreateSchema.parse(templateData);

    return this.#httpClient
      .post<BudgetResponse>(`${this.#apiUrl}`, validatedRequest)
      .pipe(
        map((response) => {
          if (!response.data || Array.isArray(response.data)) {
            throw new Error('Réponse invalide: budget manquant');
          }

          const result: CreateBudgetApiResponse = {
            budget: response.data,
            message: 'Budget créé avec succès à partir du template',
          };

          this.#saveBudgetToStorage(response.data);
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
    return this.#httpClient.get<BudgetResponse>(this.#apiUrl).pipe(
      map((response) => {
        return Array.isArray(response.data) ? response.data : [];
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
   * Récupère un budget spécifique par ID
   */
  getBudgetById$(budgetId: string): Observable<Budget> {
    return this.#httpClient
      .get<BudgetResponse>(`${this.#apiUrl}/${budgetId}`)
      .pipe(
        map((response) => {
          if (!response.data || Array.isArray(response.data)) {
            throw new Error('Budget non trouvé');
          }

          return response.data;
        }),
        catchError((error) =>
          this.#handleApiError(
            error,
            'Erreur lors de la récupération du budget',
          ),
        ),
      );
  }

  /**
   * Récupère un budget avec toutes ses données associées (transactions et lignes budgétaires)
   */
  getBudgetWithDetails$(budgetId: string): Observable<BudgetDetailsResponse> {
    return this.#httpClient
      .get<BudgetDetailsResponse>(`${this.#apiUrl}/${budgetId}/details`)
      .pipe(
        map((response) => {
          if (!response.data) {
            throw new Error('Données du budget non trouvées');
          }

          // Sauvegarder le budget principal dans le localStorage
          this.#saveBudgetToStorage(response.data.budget);

          return response;
        }),
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
      .patch<BudgetResponse>(`${this.#apiUrl}/${budgetId}`, updateData)
      .pipe(
        map((response) => {
          if (!response.data || Array.isArray(response.data)) {
            throw new Error('Réponse invalide: budget manquant');
          }

          this.#saveBudgetToStorage(response.data);
          return response.data;
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
   * Supprime un budget
   */
  deleteBudget$(budgetId: string): Observable<void> {
    return this.#httpClient.delete(`${this.#apiUrl}/${budgetId}`).pipe(
      map(() => {
        this.#removeBudgetFromStorage(budgetId);
      }),
      catchError((error) =>
        this.#handleApiError(error, 'Erreur lors de la suppression du budget'),
      ),
    );
  }

  /**
   * Exporte tous les budgets avec leurs détails au format JSON
   */
  exportAllBudgets$(): Observable<void> {
    return this.#httpClient.get(`${this.#apiUrl}/export`).pipe(
      map((response) => {
        const exportData = JSON.stringify(response, null, 2);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');

        try {
          link.href = url;
          const today = new Date();
          const dateStr = today.toISOString().split('T')[0];
          link.download = `pulpe-export-${dateStr}.json`;
          document.body.appendChild(link);
          link.click();
        } finally {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
      }),
      catchError((error) =>
        this.#handleApiError(error, "Erreur lors de l'export des budgets"),
      ),
    );
  }

  /**
   * Récupère le budget actuel depuis le localStorage
   */
  getCurrentBudgetFromStorage(): Budget | null {
    try {
      const savedBudget = localStorage.getItem(CURRENT_BUDGET_STORAGE_KEY);
      if (!savedBudget) {
        return null;
      }

      const parsedData = JSON.parse(savedBudget);
      // Utiliser la validation Zod du schéma partagé
      const result = budgetSchema.safeParse(parsedData);

      if (result.success && result.data) {
        return result.data;
      }

      this.#logger.warn(
        'Données de budget invalides dans localStorage, suppression',
      );
      localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
      return null;
    } catch (error) {
      this.#logger.error(
        'Erreur lors de la lecture du budget depuis localStorage:',
        error,
      );
      localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
      return null;
    }
  }

  #saveBudgetToStorage(budget: Budget): void {
    try {
      localStorage.setItem(CURRENT_BUDGET_STORAGE_KEY, JSON.stringify(budget));
    } catch (error) {
      this.#logger.error(
        'Erreur lors de la sauvegarde du budget dans localStorage:',
        error,
      );
    }
  }

  #removeBudgetFromStorage(budgetId: string): void {
    try {
      const currentBudget = this.getCurrentBudgetFromStorage();
      if (currentBudget?.id === budgetId) {
        localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
      }
    } catch (error) {
      this.#logger.error(
        'Erreur lors de la suppression du budget du localStorage:',
        error,
      );
    }
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
