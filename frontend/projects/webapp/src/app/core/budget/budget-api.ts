import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  type Budget,
  type BudgetCreate,
  budgetCreateSchema,
  type BudgetResponse,
  type BudgetDetailsResponse,
  budgetSchema,
} from '@pulpe/shared';
import { type Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApplicationConfiguration } from '../config/application-configuration';

export interface CreateBudgetApiResponse {
  readonly budget: Budget;
  readonly message: string;
}

const CURRENT_BUDGET_STORAGE_KEY = 'pulpe-current-budget';

@Injectable({
  providedIn: 'root',
})
export class BudgetApi {
  readonly #httpClient = inject(HttpClient);
  readonly #applicationConfig = inject(ApplicationConfiguration);

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
}
