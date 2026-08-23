import {
  type BudgetLineSavingsWithdrawalCreate,
  budgetLineSavingsWithdrawalCreateSchema,
  type BudgetLineSavingsWithdrawalDeleteQuery,
  type BudgetLineSavingsWithdrawalResponse,
  budgetLineSavingsWithdrawalResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/**
 * One call, two lines: the income that covers this month and the saving that
 * puts it back next month. They are created together because a half-pair would
 * be a month covered by nothing, and the sum over the two months is zero by
 * construction — hence the single `amount`.
 *
 * `groupId` is the idempotency key, minted once per intention and replayed on
 * retry so a second attempt returns the original pair instead of a second one.
 */
export function createSavingsWithdrawal(
  payload: BudgetLineSavingsWithdrawalCreate,
): Promise<BudgetLineSavingsWithdrawalResponse["data"]> {
  return api
    .post<
      BudgetLineSavingsWithdrawalResponse,
      BudgetLineSavingsWithdrawalCreate
    >(ENDPOINTS.budgetLinesSavingsWithdrawal, payload, budgetLineSavingsWithdrawalResponseSchema, budgetLineSavingsWithdrawalCreateSchema)
    .then((response) => response.data);
}

/**
 * Deleting one half is a choice, never a default: `pair` cancels the whole
 * thing, `repayment` keeps the money taken and drops the giving back.
 */
export function deleteSavingsWithdrawal(input: {
  groupId: string;
  scope: BudgetLineSavingsWithdrawalDeleteQuery["scope"];
}): Promise<void> {
  return api.deleteVoid(
    ENDPOINTS.budgetLinesSavingsWithdrawalGroup(input.groupId),
    { scope: input.scope },
  );
}
