import {
  type Budget,
  type BudgetCreate,
  budgetCreateSchema,
  budgetResponseSchema,
} from "pulpe-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

import { budgetKeys } from "./budget-queries";

function createBudget(payload: BudgetCreate): Promise<Budget> {
  return api
    .post<
      { data: Budget },
      BudgetCreate
    >(ENDPOINTS.budgets, payload, budgetResponseSchema, budgetCreateSchema)
    .then((response) => response.data);
}

/**
 * A new budget changes which period counts as current, so the whole budget
 * prefix is swept rather than the new detail alone.
 */
export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBudget,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}
