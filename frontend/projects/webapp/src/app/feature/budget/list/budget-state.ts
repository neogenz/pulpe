import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetApi } from '@core/budget/budget-api';
import { type MonthInfo } from '@core/budget/month-info';
import { format } from 'date-fns';
import { frCH } from 'date-fns/locale';
import { Logger } from '@core/logging/logger';

@Injectable()
export class BudgetState {
  #budgetApi = inject(BudgetApi);
  #logger = inject(Logger);

  monthsData = resource<MonthInfo[], void>({
    loader: async () => this.#loadMonthsData(),
  });

  refreshData(): void {
    if (this.monthsData.status() !== 'loading') {
      this.monthsData.reload();
    }
  }

  async #loadMonthsData(): Promise<MonthInfo[]> {
    try {
      const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());

      // Fetch summary for each budget to get the available to spend amount
      const monthsWithSummary = await Promise.all(
        budgets.map(async (budget) => {
          try {
            const summaryResponse = await firstValueFrom(
              this.#budgetApi.getBudgetSummary$(budget.id),
            );
            return {
              month: budget.month,
              year: budget.year,
              budgetId: budget.id,
              description: budget.description,
              displayName: this.#formatMonthYear(budget.month, budget.year),
              availableToSpend: summaryResponse.data.availableToSpend,
            };
          } catch (error) {
            // If fetching summary fails, return budget without financial data
            this.#logger.warn(
              `Failed to fetch summary for budget ${budget.id}:`,
              error,
            );
            return {
              month: budget.month,
              year: budget.year,
              budgetId: budget.id,
              description: budget.description,
              displayName: this.#formatMonthYear(budget.month, budget.year),
              availableToSpend: budget.endingBalance ?? 0,
            };
          }
        }),
      );

      return monthsWithSummary.sort((a: MonthInfo, b: MonthInfo) => {
        // Trier par année décroissante puis par mois décroissant
        if (a.year !== b.year) {
          return b.year - a.year;
        }
        return b.month - a.month;
      });
    } catch (error) {
      this.#logger.error('Erreur lors du chargement des mois:', error);
      throw error;
    }
  }

  #formatMonthYear(month: number, year: number): string {
    const date = new Date(year, month - 1, 1);
    return format(date, 'MMMM yyyy', { locale: frCH });
  }
}
