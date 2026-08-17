import { useMutation, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "./transaction-api";

/**
 * No optimistic write, unlike the toggle: each of these happens behind a form
 * or a confirmation the user is already waiting on, so there is no tap latency
 * to hide. Only the sweep is shared — an operation moves the realized side of
 * every aggregate the budget carries.
 */
function useTransactionMutation<TInput, TResult>(
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

export function useCreateTransaction() {
  return useTransactionMutation(createTransaction);
}

export function useUpdateTransaction() {
  return useTransactionMutation(updateTransaction);
}

export function useDeleteTransaction() {
  return useTransactionMutation(deleteTransaction);
}

/**
 * Undo, which is a create carrying the id the deleted row had. Separate from
 * `useCreateTransaction` only so a screen can show the two states apart — a
 * restore in flight is not a new entry in flight.
 */
export function useRestoreTransaction() {
  return useTransactionMutation(createTransaction);
}
