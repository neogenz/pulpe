import { map, of, switchMap, type Observable } from 'rxjs';
import type { BudgetApi } from '@core/budget';
import type { BudgetCache } from '@core/budget/budget-cache';
import { type DashboardData } from './current-month-state';

export function createDashboardDataLoader(
  budgetApi: BudgetApi,
  budgetCache: BudgetCache,
): (params: { month: string; year: string }) => Observable<DashboardData> {
  return (params) => {
    const monthNumber = parseInt(params.month, 10);
    const yearNumber = parseInt(params.year, 10);

    // Cache-first: reuse preloaded budget list — see DR-005 in memory-bank/techContext.md
    const cachedBudgets = budgetCache.budgets();
    const cachedBudget = cachedBudgets?.find(
      (b) => b.month === monthNumber && b.year === yearNumber,
    );

    const budget$ = cachedBudget
      ? of(cachedBudget)
      : budgetApi.getBudgetForMonth$(params.month, params.year);

    return budget$.pipe(
      switchMap((budget) => {
        if (!budget) {
          return of({ budget: null, transactions: [], budgetLines: [] });
        }

        const cachedDetails = budgetCache.getBudgetDetails(budget.id);
        if (cachedDetails) {
          return of({
            budget: cachedDetails.budget,
            transactions: cachedDetails.transactions,
            budgetLines: cachedDetails.budgetLines,
          });
        }

        return budgetApi.getBudgetWithDetails$(budget.id).pipe(
          map((response) => ({
            budget: response.data.budget,
            transactions: response.data.transactions,
            budgetLines: response.data.budgetLines,
          })),
        );
      }),
    );
  };
}
