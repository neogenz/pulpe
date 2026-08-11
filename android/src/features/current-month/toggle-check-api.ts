import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import type { CheckableItem } from "./current-month-view-model";

/**
 * Points an operation, or unpoints it — the server reads the current state and
 * flips it, so there is nothing to send. The updated entity comes back in the
 * response and is discarded: the caller refetches the whole budget, which is
 * the only thing that also moves the aggregates the toggle changed.
 */
export function toggleCheck(item: CheckableItem): Promise<void> {
  return api.postVoid(
    item.source === "budgetLine"
      ? ENDPOINTS.budgetLineToggle(item.sourceId)
      : ENDPOINTS.transactionToggle(item.sourceId),
  );
}
