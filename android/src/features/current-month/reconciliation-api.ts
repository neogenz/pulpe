import {
  type ReconciliationContext,
  type ReconciliationState,
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

/** The money from before Pulpe, or the end of a comparison: what the server now holds. */
export function writeReconciliationState(
  patch: UpdateReconciliationState,
): Promise<ReconciliationState> {
  return api
    .put(
      ENDPOINTS.reconciliationState,
      patch,
      reconciliationStateResponseSchema,
      updateReconciliationStateSchema,
    )
    .then((response) => response.data);
}

/** A comparison went to its end: the next one is no longer the first. */
export function completeReconciliation(): Promise<unknown> {
  return writeReconciliationState({ completed: true });
}
