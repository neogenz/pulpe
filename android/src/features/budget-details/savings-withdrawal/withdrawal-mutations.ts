import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  budgetKeys,
  invalidateBudget,
} from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createSavingsWithdrawal,
  deleteSavingsWithdrawal,
} from "./withdrawal-api";

/**
 * Both halves of a withdrawal live in different months, and the response names
 * them. The one case that still sweeps is the month the request had to create:
 * a new budget is a new list entry and a new period, which no line id can say.
 */
export function useCreateSavingsWithdrawal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSavingsWithdrawal,
    onSuccess: ({ incomeLine, savingLine, createdBudget }) => {
      void (createdBudget === null
        ? Promise.all(
            [incomeLine.budgetId, savingLine.budgetId].map((budgetId) =>
              invalidateBudget(queryClient, budgetId),
            ),
          )
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
