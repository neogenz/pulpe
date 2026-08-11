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

/**
 * Every budget, as periods plus aggregates — enough for the budgets list and
 * for the dashboard to resolve which period it is living in, off one cache
 * entry rather than two requests asking the same endpoint for overlapping
 * columns.
 *
 * Deliberately unbounded, unlike the iOS `limit: 13` — the list comes back
 * newest period first, so a limit silently drops the current month as soon as
 * the user has more future budgets than the limit leaves room for.
 */
export function fetchBudgetList(): Promise<BudgetSparse[]> {
  return api
    .get(ENDPOINTS.budgets, budgetSparseListResponseSchema, {
      fields: SPARSE_FIELDS,
    })
    .then((response) => response.data);
}

/** One call for the budget, its lines and its transactions — plus the rollover. */
export function fetchBudgetDetails(budgetId: string): Promise<BudgetDetails> {
  return api
    .get(ENDPOINTS.budgetDetails(budgetId), budgetDetailsResponseSchema)
    .then((response) => response.data);
}
