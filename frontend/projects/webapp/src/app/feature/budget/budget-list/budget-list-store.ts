import {
  Injectable,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { BudgetApi } from '@core/budget/budget-api';
import { Logger } from '@core/logging/logger';
import {
  type Budget,
  type BudgetSearchResponse,
  type BudgetLineSearchResult,
  type TransactionSearchResult,
} from '@pulpe/shared';
import { firstValueFrom } from 'rxjs';

export interface BudgetPlaceholder {
  month: number;
  year: number;
}

export interface SearchState {
  readonly results: {
    readonly budgetLines: readonly BudgetLineSearchResult[];
    readonly transactions: readonly TransactionSearchResult[];
  } | null;
  readonly isLoading: boolean;
  readonly hasError: boolean;
  readonly query: string;
}

@Injectable()
export class BudgetListStore {
  #budgetApi = inject(BudgetApi);
  #logger = inject(Logger);

  // Maximum de mois à rechercher dans le futur (3 ans)
  private static readonly MAX_FUTURE_MONTHS_TO_SEARCH = 36;

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
      const currentYear = previous?.value ?? new Date().getFullYear();
      const isExistingYear = years.includes(currentYear);
      if (isExistingYear) {
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

  /**
   * Calcule le prochain mois disponible sans budget existant
   * Recherche à partir du mois actuel jusqu'à 3 ans dans le futur
   */
  nextAvailableMonth = computed(() => {
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

  // Search state
  searchState = signal<SearchState>({
    results: null,
    isLoading: false,
    hasError: false,
    query: '',
  });

  refreshData(): void {
    if (this.budgets.status() !== 'loading') {
      this.budgets.reload();
    }
  }

  setSelectedYear(year: number): void {
    this.selectedYear.set(year);
  }

  /**
   * Recherche dans les lignes budgétaires et transactions
   */
  async search(query: string): Promise<void> {
    if (!query || query.trim().length < 2) {
      this.clearSearch();
      return;
    }

    const trimmedQuery = query.trim();

    this.searchState.set({
      results: null,
      isLoading: true,
      hasError: false,
      query: trimmedQuery,
    });

    try {
      const response = await firstValueFrom(
        this.#budgetApi.search$(trimmedQuery),
      );

      this.searchState.set({
        results: response.data,
        isLoading: false,
        hasError: false,
        query: trimmedQuery,
      });
    } catch (error) {
      this.#logger.error('Erreur lors de la recherche:', error);
      this.searchState.set({
        results: null,
        isLoading: false,
        hasError: true,
        query: trimmedQuery,
      });
    }
  }

  /**
   * Efface les résultats de recherche
   */
  clearSearch(): void {
    this.searchState.set({
      results: null,
      isLoading: false,
      hasError: false,
      query: '',
    });
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
