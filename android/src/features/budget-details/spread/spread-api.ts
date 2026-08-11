import {
  type BudgetLineSpreadCreate,
  budgetLineSpreadCreateSchema,
  type BudgetLineSpreadFromLineCreate,
  budgetLineSpreadFromLineCreateSchema,
  type BudgetLineSpreadResponse,
  budgetLineSpreadResponseSchema,
  type SpreadOccurrence,
  spreadOccurrencesResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/**
 * The client sends an intention — a mode, an amount, and the months — never
 * the tranches themselves. The server builds them, which is what keeps the sum
 * exact when it divides a total.
 *
 * `spreadGroupId` is the idempotency key: minted once per intention and
 * replayed unchanged on a retry, so a request that fails after the rows were
 * written does not create a second group.
 */
export function createSpread(
  payload: BudgetLineSpreadCreate,
): Promise<BudgetLineSpreadResponse["data"]> {
  return api
    .post<
      BudgetLineSpreadResponse,
      BudgetLineSpreadCreate
    >(ENDPOINTS.budgetLinesSpread, payload, budgetLineSpreadResponseSchema, budgetLineSpreadCreateSchema)
    .then((response) => response.data);
}

/**
 * Spreading a forecast that already exists redistributes its own total: the
 * client names only the months, because the amount lives encrypted on the
 * server and only it can guarantee the parts add back up.
 */
export function spreadExistingLine(input: {
  budgetLineId: string;
  periods: BudgetLineSpreadFromLineCreate["periods"];
}): Promise<BudgetLineSpreadResponse["data"]> {
  return api
    .post<
      BudgetLineSpreadResponse,
      BudgetLineSpreadFromLineCreate
    >(ENDPOINTS.budgetLineSpreadFromLine(input.budgetLineId), { periods: input.periods }, budgetLineSpreadResponseSchema, budgetLineSpreadFromLineCreateSchema)
    .then((response) => response.data);
}

export function fetchSpreadOccurrences(
  spreadGroupId: string,
): Promise<SpreadOccurrence[]> {
  return api
    .get(
      ENDPOINTS.budgetLinesSpreadOccurrences(spreadGroupId),
      spreadOccurrencesResponseSchema,
    )
    .then((response) => response.data);
}
