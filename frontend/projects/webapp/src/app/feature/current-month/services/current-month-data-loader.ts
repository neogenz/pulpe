import { map, of, switchMap, type Observable } from 'rxjs';
import type { BudgetApi } from '@core/budget';
import type { BudgetCache } from '@core/budget/budget-cache';
import { type DashboardData } from './current-month-state';

export function createDashboardDataLoader(
  budgetApi: BudgetApi,
  budgetCache: BudgetCache,
): (params: { month: string; year: string }) => Observable<DashboardData> {
  return (params) =>
    budgetApi.getBudgetForMonth$(params.month, params.year).pipe(
      switchMap((budget) => {
        if (!budget) {
          return of({ budget: null, transactions: [], budgetLines: [] });
        }

        const cached = budgetCache.getBudgetDetails(budget.id);
        if (cached) {
          return of({
            budget: cached.budget,
            transactions: cached.transactions,
            budgetLines: cached.budgetLines,
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
}
