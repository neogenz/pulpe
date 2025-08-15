import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BudgetApi, type MonthInfo } from '../budget-api';
import { Logger } from '../../../core/logging/logger';

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
      return await firstValueFrom(this.#budgetApi.getExistingMonthsBudgets$());
    } catch (error) {
      this.#logger.error('Erreur lors du chargement des mois:', error);
      throw error;
    }
  }
}
