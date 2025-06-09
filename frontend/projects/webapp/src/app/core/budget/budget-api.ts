import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  type Budget,
  type BudgetCreateRequest,
  type BudgetResponse,
  budgetResponseSchema,
  budgetErrorResponseSchema,
  type BudgetCreateFromOnboardingApiRequest,
  budgetCreateFromOnboardingApiRequestSchema,
} from '@pulpe/shared';
import { MonthlyBudget, BudgetCategory } from './budget.models';
import { environment } from '../../../environments/environment';

export interface CreateBudgetApiResponse {
  readonly budget: Budget;
  readonly message: string;
}

export interface BudgetApiError {
  readonly message: string;
  readonly details?: readonly string[];
}

const CURRENT_BUDGET_STORAGE_KEY = 'pulpe-current-budget';

@Injectable({
  providedIn: 'root',
})
export class BudgetApi {
  readonly #httpClient = inject(HttpClient);
  readonly #baseUrl = `${environment.backendUrl}/budgets`;

  /**
   * Crée un budget à partir des données d'onboarding
   * Transforme les données business en DTO pour l'API
   */
  createOnboardingBudget$(
    onboardingData: BudgetCreateFromOnboardingApiRequest,
  ): Observable<CreateBudgetApiResponse> {
    // Transformer les données business en DTO pour l'API
    const budgetDto: BudgetCreateFromOnboardingApiRequest = {
      ...onboardingData,
      month: onboardingData.month,
      year: onboardingData.year,
      description: onboardingData.description,
    };

    // Valider les données avec le schéma partagé
    const validatedRequest =
      budgetCreateFromOnboardingApiRequestSchema.parse(budgetDto);

    return this.#httpClient
      .post<BudgetResponse>(
        `${this.#baseUrl}/from-onboarding`,
        validatedRequest,
      )
      .pipe(
        map((response) => {
          // Valider la réponse avec le schéma partagé
          const validatedResponse = budgetResponseSchema.parse(response);

          if (!validatedResponse.budget) {
            throw new Error('Réponse invalide: budget manquant');
          }

          const result: CreateBudgetApiResponse = {
            budget: validatedResponse.budget,
            message: 'Budget créé avec succès',
          };

          this.#saveBudgetToStorage(validatedResponse.budget);
          return result;
        }),
        catchError((error) =>
          this.#handleApiError(error, 'Erreur lors de la création du budget'),
        ),
      );
  }

  /**
   * Récupère tous les budgets de l'utilisateur
   */
  getAllBudgets$(): Observable<readonly Budget[]> {
    return this.#httpClient.get<BudgetResponse>(this.#baseUrl).pipe(
      map((response) => {
        const validatedResponse = budgetResponseSchema.parse(response);
        return validatedResponse.budgets || [];
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
      .get<BudgetResponse>(`${this.#baseUrl}/${budgetId}`)
      .pipe(
        map((response) => {
          const validatedResponse = budgetResponseSchema.parse(response);

          if (!validatedResponse.budget) {
            throw new Error('Budget non trouvé');
          }

          return validatedResponse.budget;
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
    updateData: Partial<BudgetCreateRequest>,
  ): Observable<Budget> {
    return this.#httpClient
      .put<BudgetResponse>(`${this.#baseUrl}/${budgetId}`, updateData)
      .pipe(
        map((response) => {
          const validatedResponse = budgetResponseSchema.parse(response);

          if (!validatedResponse.budget) {
            throw new Error('Réponse invalide: budget manquant');
          }

          this.#saveBudgetToStorage(validatedResponse.budget);
          return validatedResponse.budget;
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
    return this.#httpClient.delete(`${this.#baseUrl}/${budgetId}`).pipe(
      map(() => {
        this.#removeBudgetFromStorage(budgetId);
      }),
      catchError((error) =>
        this.#handleApiError(error, 'Erreur lors de la suppression du budget'),
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
      const result = budgetResponseSchema.shape.budget.safeParse(parsedData);

      if (result.success && result.data) {
        return result.data;
      }

      console.warn(
        'Données de budget invalides dans localStorage, suppression',
      );
      localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
      return null;
    } catch (error) {
      console.error(
        'Erreur lors de la lecture du budget depuis localStorage:',
        error,
      );
      localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
      return null;
    }
  }

  /**
   * Adapte un Budget DTO vers un MonthlyBudget business model
   * TODO: À l'avenir, récupérer les vraies catégories depuis l'API
   */
  #adaptBudgetDtoToBusinessModel(budgetDto: Budget): MonthlyBudget {
    // Pour l'instant, on crée des catégories par défaut
    // Plus tard, ces catégories viendront d'une API dédiée
    const defaultCategories: readonly BudgetCategory[] = [
      {
        id: 'income-salary',
        name: 'Salaire',
        plannedAmount: 5000,
        actualAmount: 5000,
        type: 'income',
      },
      {
        id: 'expense-housing',
        name: 'Logement',
        plannedAmount: 1500,
        actualAmount: 1500,
        type: 'expense',
      },
      {
        id: 'expense-food',
        name: 'Alimentation',
        plannedAmount: 600,
        actualAmount: 450,
        type: 'expense',
      },
      {
        id: 'savings-emergency',
        name: "Épargne d'urgence",
        plannedAmount: 500,
        actualAmount: 500,
        type: 'savings',
      },
    ];

    return {
      id: budgetDto.id,
      userId: budgetDto.user_id || '',
      month: budgetDto.month.toString().padStart(2, '0'),
      year: budgetDto.year.toString(),
      categories: defaultCategories,
      createdAt: budgetDto.created_at,
      updatedAt: budgetDto.updated_at,
    };
  }

  #saveBudgetToStorage(budget: Budget): void {
    try {
      localStorage.setItem(CURRENT_BUDGET_STORAGE_KEY, JSON.stringify(budget));
    } catch (error) {
      console.error(
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
      console.error(
        'Erreur lors de la suppression du budget du localStorage:',
        error,
      );
    }
  }

  #handleApiError(error: unknown, defaultMessage: string): Observable<never> {
    console.error('Erreur API Budget:', error);

    if (error instanceof HttpErrorResponse) {
      // Utiliser le schéma d'erreur partagé
      try {
        const errorResponse = budgetErrorResponseSchema.parse(error.error);
        const budgetError: BudgetApiError = {
          message: errorResponse.error,
          details: errorResponse.details,
        };
        return throwError(() => budgetError);
      } catch {
        const budgetError: BudgetApiError = {
          message: error.error?.message || error.message || defaultMessage,
        };
        return throwError(() => budgetError);
      }
    }

    const budgetError: BudgetApiError = {
      message: defaultMessage,
    };
    return throwError(() => budgetError);
  }
}
