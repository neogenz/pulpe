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
 * why the response names them — the caller sweeps the whole budget prefix
 * rather than trying to guess which two entries went stale.
 */
export function postponeBudgetLine(budgetLineId: string): Promise<void> {
  return api
    .post(
      ENDPOINTS.budgetLinePostpone(budgetLineId),
      undefined,
      budgetLinePostponeResponseSchema,
    )
    .then(() => undefined);
}
