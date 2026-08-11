import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/**
 * All the toggle needs to know: which of the two endpoints answers for this
 * row. A budget line and a transaction can share an id, so the source travels
 * with it rather than being guessed from the shape.
 */
export interface CheckTarget {
  source: "budgetLine" | "transaction";
  sourceId: string;
}

/**
 * Points an operation, or unpoints it — the server reads the current state and
 * flips it, so there is nothing to send. The updated entity comes back in the
 * response and is discarded: the caller refetches the whole budget, which is
 * the only thing that also moves the aggregates the toggle changed.
 */
export function toggleCheck(target: CheckTarget): Promise<void> {
  return api.postVoid(
    target.source === "budgetLine"
      ? ENDPOINTS.budgetLineToggle(target.sourceId)
      : ENDPOINTS.transactionToggle(target.sourceId),
  );
}
