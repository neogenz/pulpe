import {
  type ReconciliationContext,
  reconciliationContextResponseSchema,
  reconciliationStateResponseSchema,
  type UpdateReconciliationState,
  updateReconciliationStateSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/** What the server adds to the compared figure, and my comparison state (spec.md §4.1). */
export function fetchReconciliationContext(
  budgetId: string,
): Promise<ReconciliationContext> {
  return api
    .get(
      ENDPOINTS.reconciliationContext(budgetId),
      reconciliationContextResponseSchema,
    )
    .then((response) => response.data);
}

/** A comparison went to its end: the next one is no longer the first. */
export function completeReconciliation(): Promise<unknown> {
  return api.put<unknown, UpdateReconciliationState>(
    ENDPOINTS.reconciliationState,
    { completed: true },
    reconciliationStateResponseSchema,
    updateReconciliationStateSchema,
  );
}
