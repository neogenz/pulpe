import { Injectable } from '@angular/core';
import { format } from 'date-fns';
import { Observable, of } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';
import {
  BudgetCategory,
  CreateBudgetResponse,
  CreateOnboardingBudgetRequest,
  MonthlyBudget,
} from './budget.models';

import {
  CreateBudgetResponseSchema,
  MonthlyBudgetSchema,
} from './budget.models';

const CURRENT_BUDGET_STORAGE_KEY = 'pulpe-current-budget';

@Injectable({
  providedIn: 'root',
})
export class BudgetApi {
  /**
   * Crée un budget à partir des données d'onboarding
   * La validation Zod assure que les données du serveur sont conformes
   */
  createOnboardingBudget$(
    onboardingData: CreateOnboardingBudgetRequest,
  ): Observable<CreateBudgetResponse> {
    return this.#mockCreateBudgetCall(onboardingData).pipe(
      map((response) => {
        // Validate the response from server with Zod
        const validatedResponse = CreateBudgetResponseSchema.parse(response);
        this.#saveCurrentBudgetToStorage(validatedResponse.budget);
        return validatedResponse;
      }),
      catchError((error) => {
        console.error('Failed to create onboarding budget:', error);
        throw error;
      }),
    );
  }

  /**
   * Récupère le budget pour un mois et une année donnés
   * @param month - Le mois (format MM)
   * @param year - L'année (format yyyy)
   * @returns Le budget pour le mois et l'année donnés
   */
  getBudgetForMonth$(
    month: string,
    year: string,
  ): Observable<MonthlyBudget | null> {
    console.log('[BudgetApi] mock getBudgetForMonth$', month, year);
    return of(this.#loadCurrentBudgetFromStorage()).pipe(delay(1500));
  }

  #mockCreateBudgetCall(
    data: CreateOnboardingBudgetRequest,
  ): Observable<CreateBudgetResponse> {
    const mockBudget: MonthlyBudget = {
      id: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      month: format(new Date(), 'MM'),
      year: format(new Date(), 'yyyy'),
      categories: this.#createDefaultCategories(data),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const response: CreateBudgetResponse = {
      budget: mockBudget,
      message: `Budget créé avec succès pour ${data.firstName}`,
    };

    return of(response).pipe(delay(1500));
  }

  #createDefaultCategories(
    data: CreateOnboardingBudgetRequest,
  ): readonly BudgetCategory[] {
    return [
      {
        id: 'income-salary',
        name: 'Salaire',
        plannedAmount: data.monthlyIncome,
        actualAmount: data.monthlyIncome,
        type: 'income',
      },
      {
        id: 'expense-housing',
        name: 'Logement',
        plannedAmount: data.housingCosts,
        actualAmount: data.housingCosts,
        type: 'expense',
      },
      {
        id: 'expense-health',
        name: 'Assurance maladie',
        plannedAmount: data.healthInsurance,
        actualAmount: data.healthInsurance,
        type: 'expense',
      },
      {
        id: 'expense-leasing',
        name: 'Leasing/Crédit',
        plannedAmount: data.leasingCredit,
        actualAmount: data.leasingCredit,
        type: 'expense',
      },
      {
        id: 'expense-phone',
        name: 'Téléphone',
        plannedAmount: data.phonePlan,
        actualAmount: data.phonePlan,
        type: 'expense',
      },
      {
        id: 'expense-transport',
        name: 'Transport',
        plannedAmount: data.transportCosts,
        actualAmount: data.transportCosts,
        type: 'expense',
      },
    ];
  }

  #saveCurrentBudgetToStorage(budget: MonthlyBudget): void {
    try {
      localStorage.setItem(CURRENT_BUDGET_STORAGE_KEY, JSON.stringify(budget));
    } catch (error) {
      console.error('Failed to save budget to localStorage:', error);
    }
  }

  #loadCurrentBudgetFromStorage(): MonthlyBudget | null {
    try {
      const savedBudget = localStorage.getItem(CURRENT_BUDGET_STORAGE_KEY);
      if (savedBudget) {
        const parsedData = JSON.parse(savedBudget);
        // Use safe parsing to handle potential invalid data in localStorage
        const result = MonthlyBudgetSchema.safeParse(parsedData);
        if (result.success) {
          return result.data;
        } else {
          console.warn(
            'Invalid budget data in localStorage, clearing it:',
            result.error,
          );
          localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Failed to load budget from localStorage:', error);
      localStorage.removeItem(CURRENT_BUDGET_STORAGE_KEY);
    }
    return null;
  }
}
