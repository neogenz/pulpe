import {
  type BudgetDetailsResponse,
  type BudgetSparse,
  budgetDetailsResponseSchema,
  budgetSparseListResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export type BudgetDetails = BudgetDetailsResponse["data"];

/** The same fieldset as `BudgetService.defaultSparseFields`. */
const SPARSE_FIELDS =
  "month,year,totalIncome,totalExpenses,totalSavings,rollover,remaining";
export const BUDGET_PAGE_SIZE = 36;

/**
 * One ordered history page. The dashboard resolves its current period through
 * the smaller yearly query below, so neither surface depends on an unbounded
 * account history.
 */
export function fetchBudgetListPage(offset: number): Promise<BudgetSparse[]> {
  return api
    .get(ENDPOINTS.budgets, budgetSparseListResponseSchema, {
      fields: SPARSE_FIELDS,
      limit: BUDGET_PAGE_SIZE,
      offset,
    })
    .then((response) => response.data);
}

/** Period-only lookup used by dashboards and detail navigation without history. */
export function fetchBudgetPeriods(year: number): Promise<BudgetSparse[]> {
  return api
    .get(ENDPOINTS.budgets, budgetSparseListResponseSchema, {
      fields: "month,year",
      year,
    })
    .then((response) => response.data);
}

/** One call for the budget, its lines and its transactions — plus the rollover. */
export function fetchBudgetDetails(budgetId: string): Promise<BudgetDetails> {
  return api
    .get(ENDPOINTS.budgetDetails(budgetId), budgetDetailsResponseSchema)
    .then((response) => response.data);
}
