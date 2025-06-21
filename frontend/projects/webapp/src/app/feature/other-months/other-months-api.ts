import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  type Budget,
  type BudgetListResponse,
} from '@pulpe/shared';
import { environment } from '../../../environments/environment';

export interface MonthInfo {
  month: number;
  year: number;
  budgetId: string;
  description: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root',
})
export class OtherMonthsApi {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.backendUrl}/budgets`;

  getExistingMonthsBudgets$(): Observable<MonthInfo[]> {
    return this.http.get<BudgetListResponse>(this.apiUrl).pipe(
      map((response) => {
        if (!response.data || !Array.isArray(response.data)) {
          return [];
        }

        return response.data
          .map((budget: Budget) => ({
            month: budget.month,
            year: budget.year,
            budgetId: budget.id,
            description: budget.description,
            displayName: this.#formatMonthYear(budget.month, budget.year),
          }))
          .sort((a, b) => {
            // Trier par année décroissante puis par mois décroissant
            if (a.year !== b.year) {
              return b.year - a.year;
            }
            return b.month - a.month;
          });
      })
    );
  }

  #formatMonthYear(month: number, year: number): string {
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    return `${monthNames[month - 1]} ${year}`;
  }
}