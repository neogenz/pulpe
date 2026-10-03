import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  budgetKeys,
  invalidateAfterBudgetWrite,
} from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createSavingsWithdrawal,
  deleteSavingsWithdrawal,
} from "./withdrawal-api";

/**
 * The month the request had to create is the one case that sweeps every budget
 * query: a new budget is a new list entry and a new period, not only figures
 * that moved.
 */
export function useCreateSavingsWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSavingsWithdrawal,
    onSuccess: ({ createdBudget }) => {
      void (createdBudget === null
        ? invalidateAfterBudgetWrite(queryClient)
        : queryClient.invalidateQueries({ queryKey: budgetKeys.all }));
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/**
 * Sweep kept: the group id names the pair, not the two months holding it, and
 * the half being kept or dropped is never the one on screen.
 */
export function useDeleteSavingsWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSavingsWithdrawal,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}
