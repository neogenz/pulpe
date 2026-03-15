import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { type Budget, type BudgetExportResponse } from 'pulpe-shared';
import { cachedResource } from 'ngx-ziflux';
import { firstValueFrom } from 'rxjs';

export interface BudgetPlaceholder {
  month: number;
  year: number;
}

const MAX_FUTURE_MONTHS_TO_SEARCH = 36;

@Injectable()
export class BudgetListStore {
  readonly #budgetApi = inject(BudgetApi);

  readonly budgets = cachedResource({
    cache: this.#budgetApi.cache,
    cacheKey: ['budget', 'list'],
    loader: () => this.#budgetApi.getAllBudgets$(),
  });

  readonly isLoading = this.budgets.isInitialLoading;
  readonly hasValue = computed(() => this.budgets.hasValue());
  readonly error = computed(() => this.budgets.error());

  readonly budgetsList = computed(() => this.budgets.value() ?? []);

  readonly plannedYears = computed(() => {
    const months = this.budgetsList();
    const years = [...new Set(months.map((month) => month.year))];
    return years.toSorted((a, b) => a - b); // Tri croissant
  });

  /**
   * Mensual budget planned, grouped by year
   */
  readonly plannedBudgetsGroupedByYears = computed(() => {
    const months = this.budgetsList();
    const groupedByYear = new Map<number, Budget[]>();

    months.forEach((month) => {
      const existingMonths = groupedByYear.get(month.year) ?? [];
      groupedByYear.set(month.year, [...existingMonths, month]);
    });

    // Trier les mois de chaque année par mois décroissant
    groupedByYear.forEach((months, year) => {
      groupedByYear.set(
        year,
        months.toSorted((a, b) => b.month - a.month),
      );
    });

    return groupedByYear;
  });

  /**
   * All months grouped by year, with empty months for years with unplanned budgets
   */
  readonly allMonthsGroupedByYears = computed<
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

  readonly selectedYear = linkedSignal<number[], number | null>({
    source: this.plannedYears,
    computation: (_years, previous) => {
      return previous?.value ?? new Date().getFullYear();
    },
  });

  /**
   * Calcule le prochain mois disponible sans budget existant
   * Recherche à partir du mois actuel jusqu'à 3 ans dans le futur
   */
  readonly nextAvailableMonth = computed(() => {
    const budgetsValue = this.budgetsList();
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // getMonth() retourne 0-11
    const currentYear = now.getFullYear();

    // Retour immédiat si pas de budgets
    if (!budgetsValue || budgetsValue.length === 0) {
      return { month: currentMonth, year: currentYear };
    }

    // Créer un Set pour une recherche O(1) au lieu de O(n)
    // Format: "année-mois" pour une clé unique
    const existingBudgets = new Set(
      budgetsValue.map((budget) => `${budget.year}-${budget.month}`),
    );

    // Parcourir les mois futurs pour trouver le premier disponible
    for (let i = 0; i < MAX_FUTURE_MONTHS_TO_SEARCH; i++) {
      // Calculer le mois et l'année à vérifier
      const totalMonths = currentYear * 12 + currentMonth - 1 + i;
      const year = Math.floor(totalMonths / 12);
      const month = (totalMonths % 12) + 1;

      // Vérifier si un budget existe pour ce mois (recherche O(1))
      if (!existingBudgets.has(`${year}-${month}`)) {
        return { month, year };
      }
    }

    // Fallback : retourner le mois actuel si tous les mois sont pris
    // (cas très rare, mais évite une erreur)
    return { month: currentMonth, year: currentYear };
  });

  refreshData(): void {
    if (!this.budgets.isLoading()) {
      this.budgets.reload();
    }
  }

  setSelectedYear(year: number): void {
    this.selectedYear.set(year);
  }

  async exportAllBudgets(): Promise<BudgetExportResponse> {
    return firstValueFrom(this.#budgetApi.exportAllBudgets$());
  }
}
