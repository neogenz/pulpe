import {
  Injectable,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';
import { type Budget } from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';

export interface BudgetPlaceholder {
  month: number;
  year: number;
}

@Injectable()
export class BudgetState {
  #budgetApi = inject(BudgetApi);
  #logger = inject(Logger);

  budgets = resource<Budget[], void>({
    loader: async () => this.#loadBudgets(),
  });

  plannedYears = computed(() => {
    const months = this.budgets.value() ?? [];
    const years = [...new Set(months.map((month) => month.year))];
    return years.sort((a, b) => a - b); // Tri croissant
  });

  /**
   * Mensual budget planned, grouped by year
   */
  plannedBudgetsGroupedByYears = computed(() => {
    const months = this.budgets.value() ?? [];
    const groupedByYear = new Map<number, Budget[]>();

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

  /**
   * All months grouped by year, with empty months for years with unplanned budgets
   */
  allMonthsGroupedByYears = computed<
    Map<number, (Budget | BudgetPlaceholder)[]>
  >(() => {
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
    const plannedYears = this.plannedBudgetsGroupedByYears();
    const allMonthsGroupedByYears = new Map<
      number,
      (Budget | BudgetPlaceholder)[]
    >();
    for (const year of plannedYears.keys()) {
      const plannedBudgets = plannedYears.get(year) ?? [];
      const allMonthsForYear = allMonths.map((month) => {
        const plannedBudget = plannedBudgets.find(
          (budget) => budget.month === month,
        );
        if (plannedBudget) {
          return plannedBudget;
        }
        return {
          month,
          year,
        };
      });
      allMonthsGroupedByYears.set(year, allMonthsForYear);
    }
    return allMonthsGroupedByYears;
  });

  selectedYear = linkedSignal<number[], number | null>({
    source: this.plannedYears,
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
    const years = this.plannedYears();

    if (!year || years.length === 0) return 0;

    return Math.max(0, years.indexOf(year));
  });

  refreshData(): void {
    if (this.budgets.status() !== 'loading') {
      this.budgets.reload();
    }
  }

  setSelectedYear(year: number): void {
    this.selectedYear.set(year);
  }

  async #loadBudgets(): Promise<Budget[]> {
    try {
      const budgets = await firstValueFrom(this.#budgetApi.getAllBudgets$());
      return budgets.sort((a: Budget, b: Budget) => {
        // Trier par année décroissante puis par mois décroissant
        if (a.year !== b.year) {
          return a.year - b.year;
        }
        return a.month - b.month;
      });
    } catch (error) {
      this.#logger.error('Erreur lors du chargement des mois:', error);
      throw error;
    }
  }
}
