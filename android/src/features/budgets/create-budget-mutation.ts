import {
  type Budget,
  type BudgetCreate,
  budgetCreateSchema,
  budgetResponseSchema,
} from "pulpe-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";
import { goalKeys } from "@/features/savings-goals/goals-queries";
import { templateKeys } from "@/features/templates/template-queries";

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
    // The new lines carry their template line's goal, and the template its usage.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
        queryClient.invalidateQueries({ queryKey: goalKeys.all }),
        queryClient.invalidateQueries({ queryKey: templateKeys.all }),
      ]),
  });
}
