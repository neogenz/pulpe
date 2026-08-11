import { useMutation, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";

import { createTransaction } from "./transaction-api";

/**
 * No optimistic insert, unlike the toggle: the sheet stays up until the server
 * answers, so the user is still looking at the form when a rejection needs
 * explaining. Only the sweep is shared — a new transaction moves the realized
 * side of every aggregate the budget carries.
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
  });
}
