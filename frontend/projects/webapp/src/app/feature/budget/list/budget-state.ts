import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetApi, type MonthInfo } from '../budget-api';

@Injectable()
export class BudgetState {
  #budgetApi = inject(BudgetApi);

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
      return await firstValueFrom(this.#budgetApi.getExistingMonthsBudgets$());
    } catch (error) {
      console.error('Erreur lors du chargement des mois:', error);
      throw error;
    }
  }
}
