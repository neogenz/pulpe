import { Injectable, inject, resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { OtherMonthsApi, type MonthInfo } from './other-months-api';

@Injectable()
export class OtherMonthsState {
  #otherMonthsApi = inject(OtherMonthsApi);

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
      return await firstValueFrom(
        this.#otherMonthsApi.getExistingMonthsBudgets$(),
      );
    } catch (error) {
      console.error('Erreur lors du chargement des mois:', error);
      throw error;
    }
  }
}
