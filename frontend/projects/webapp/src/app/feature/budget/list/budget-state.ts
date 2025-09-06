import {
  Injectable,
  inject,
  resource,
  computed,
  linkedSignal,
} from '@angular/core';
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
    loader: async () => this.#loadAndTransformBudgets(),
  });

  availableYears = computed(() => {
    const months = this.monthsData.value() ?? [];
    const years = [...new Set(months.map((month) => month.year))];
    return years.sort((a, b) => a - b); // Tri croissant
  });

  budgetsByYear = computed(() => {
    const months = this.monthsData.value() ?? [];
    const groupedByYear = new Map<number, MonthInfo[]>();

    months.forEach((month) => {
      const existingMonths = groupedByYear.get(month.year) ?? [];
      groupedByYear.set(month.year, [...existingMonths, month]);
    });

    // Trier les mois de chaque année par mois décroissant
    groupedByYear.forEach((months, year) => {
      groupedByYear.set(
        year,
        months.sort((a, b) => b.month - a.month),
      );
    });

    return groupedByYear;
  });

  selectedYear = linkedSignal<number[], number | null>({
    source: this.availableYears,
    computation: (years, previous) => {
      // Garder la sélection précédente si elle existe encore
      const currentYear = previous?.value;
      const yearStillExists = currentYear && years.includes(currentYear);

      if (yearStillExists) {
        return currentYear;
      }

      // Fallback sur la première année
      return years[0] ?? null;
    },
  });

  selectedYearIndex = computed(() => {
    const year = this.selectedYear();
    const years = this.availableYears();

    if (!year || years.length === 0) return 0;

    return Math.max(0, years.indexOf(year));
  });

  refreshData(): void {
    if (this.monthsData.status() !== 'loading') {
      this.monthsData.reload();
    }
  }

  setSelectedYear(year: number): void {
    this.selectedYear.set(year);
  }

  async #loadAndTransformBudgets(): Promise<MonthInfo[]> {
    try {
      const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());
      return budgets
        .map((budget) => ({
          month: budget.month,
          year: budget.year,
          budgetId: budget.id,
          description: budget.description,
          displayName: this.#formatMonthYear(budget.month, budget.year),
          endingBalance: budget.endingBalance ?? 0,
        }))
        .sort((a: MonthInfo, b: MonthInfo) => {
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
