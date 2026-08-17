import { useMutation, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createSavingsWithdrawal,
  deleteSavingsWithdrawal,
} from "./withdrawal-api";

/**
 * Both halves of a withdrawal live in different months, and the second one's
 * budget may have been created by the request itself, so the sweep covers the
 * whole prefix rather than the two months it knows about.
 */
function useWithdrawalMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useCreateSavingsWithdrawal() {
  return useWithdrawalMutation(createSavingsWithdrawal);
}

export function useDeleteSavingsWithdrawal() {
  return useWithdrawalMutation(deleteSavingsWithdrawal);
}
