import {
  Injectable,
  computed,
  inject,
  linkedSignal,
  resource,
} from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { BudgetCache } from '@core/budget/budget-cache';
import { BudgetInvalidationService } from '@core/budget/budget-invalidation.service';
import { Logger } from '@core/logging/logger';
import { type Budget } from 'pulpe-shared';
import { firstValueFrom } from 'rxjs';

export interface BudgetPlaceholder {
  month: number;
  year: number;
}

@Injectable()
export class BudgetListStore {
  readonly #budgetApi = inject(BudgetApi);
  readonly #budgetCache = inject(BudgetCache);
  readonly #logger = inject(Logger);
  readonly #invalidationService = inject(BudgetInvalidationService);

  // Maximum de mois à rechercher dans le futur (3 ans)
  // private static uses TS keyword (not #) because static # is incompatible with class decorators
  private static readonly MAX_FUTURE_MONTHS_TO_SEARCH = 36;

  /**
   * Resource that auto-reloads when budget invalidation version changes.
   * This enables automatic cache invalidation across stores.
   */
  readonly budgets = resource<Budget[], { version: number }>({
    params: () => ({ version: this.#invalidationService.version() }),
    loader: async () => this.#loadBudgets(),
  });

  readonly isLoading = computed(() => this.budgets.isLoading());
  readonly hasValue = computed(() => this.budgets.hasValue());
  readonly error = computed(() => this.budgets.error());

  readonly plannedYears = computed(() => {
    const months = this.budgets.value() ?? [];
    const years = [...new Set(months.map((month) => month.year))];
    return years.sort((a, b) => a - b); // Tri croissant
  });

  /**
   * Mensual budget planned, grouped by year
   */
  readonly plannedBudgetsGroupedByYears = computed(() => {
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
    computation: (years, previous) => {
      // Garder la sélection précédente si elle existe encore
      const currentYear = previous?.value ?? new Date().getFullYear();
      const isExistingYear = years.includes(currentYear);
      if (isExistingYear) {
        return currentYear;
      }

      // Fallback sur la première année
      return years[0] ?? null;
    },
  });

  readonly selectedYearIndex = computed(() => {
    const year = this.selectedYear();
    const years = this.plannedYears();

    if (!year || years.length === 0) return 0;

    return Math.max(0, years.indexOf(year));
  });

  /**
   * Calcule le prochain mois disponible sans budget existant
   * Recherche à partir du mois actuel jusqu'à 3 ans dans le futur
   */
  readonly nextAvailableMonth = computed(() => {
    const budgetsValue = this.budgets.value();
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
    for (let i = 0; i < BudgetListStore.MAX_FUTURE_MONTHS_TO_SEARCH; i++) {
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
    if (!this.isLoading()) {
      this.budgets.reload();
    }
  }

  setSelectedYear(year: number): void {
    this.selectedYear.set(year);
  }

  async #loadBudgets(): Promise<Budget[]> {
    try {
      const cached = this.#budgetCache.budgets();
      const budgets =
        cached ?? (await firstValueFrom(this.#budgetApi.getAllBudgets$()));
      return budgets.sort((a: Budget, b: Budget) => {
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
