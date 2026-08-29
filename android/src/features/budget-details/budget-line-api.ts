import {
  budgetLineCreateSchema,
  budgetLinePostponeResponseSchema,
  budgetLineResponseSchema,
  budgetLineUpdateSchema,
  type BudgetLine,
  type BudgetLineCreate,
  type BudgetLineUpdate,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function createBudgetLine(
  payload: BudgetLineCreate,
): Promise<BudgetLine> {
  return api
    .post<
      { data: BudgetLine },
      BudgetLineCreate
    >(ENDPOINTS.budgetLines, payload, budgetLineResponseSchema, budgetLineCreateSchema)
    .then((response) => response.data);
}

export function updateBudgetLine(
  payload: BudgetLineUpdate,
): Promise<BudgetLine> {
  return api
    .patch<
      { data: BudgetLine },
      BudgetLineUpdate
    >(ENDPOINTS.budgetLine(payload.id), payload, budgetLineResponseSchema, budgetLineUpdateSchema)
    .then((response) => response.data);
}

export function deleteBudgetLine(budgetLineId: string): Promise<void> {
  return api.deleteVoid(ENDPOINTS.budgetLine(budgetLineId));
}

/**
 * Moves a forecast to the month after its own. Both budgets change, which is
 * why the response names them — and why the caller gets the two ids back
 * rather than guessing which entries went stale.
 */
export function postponeBudgetLine(
  budgetLineId: string,
): Promise<{ sourceBudgetId: string; targetBudgetId: string }> {
  return api
    .post(
      ENDPOINTS.budgetLinePostpone(budgetLineId),
      undefined,
      budgetLinePostponeResponseSchema,
    )
    .then(({ data }) => ({
      sourceBudgetId: data.sourceBudgetId,
      targetBudgetId: data.targetBudgetId,
    }));
}
