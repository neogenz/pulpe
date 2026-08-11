import {
  type BudgetDetailsResponse,
  type BudgetSparse,
  budgetDetailsResponseSchema,
  budgetSparseListResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export type BudgetDetails = BudgetDetailsResponse["data"];

/**
 * Sparse fieldset: the caller only needs to know which period each budget
 * covers, and the full list carries every aggregate for every month.
 *
 * Deliberately unbounded, unlike the iOS `limit: 13` — the list comes back
 * newest period first, so a limit silently drops the current month as soon as
 * the user has more future budgets than the limit leaves room for.
 */
export function fetchBudgetPeriods(): Promise<BudgetSparse[]> {
  return api
    .get(ENDPOINTS.budgets, budgetSparseListResponseSchema, {
      fields: "month,year",
    })
    .then((response) => response.data);
}

/** One call for the budget, its lines and its transactions — plus the rollover. */
export function fetchBudgetDetails(budgetId: string): Promise<BudgetDetails> {
  return api
    .get(ENDPOINTS.budgetDetails(budgetId), budgetDetailsResponseSchema)
    .then((response) => response.data);
}
