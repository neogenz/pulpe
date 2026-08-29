import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Transaction } from "pulpe-shared";

import { invalidateBudget } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "./transaction-api";

/**
 * No optimistic write, unlike the toggle: each of these happens behind a form
 * or a confirmation the user is already waiting on, so there is no tap latency
 * to hide. An operation moves the realized side of every aggregate its budget
 * carries, and only that budget's — the row names it, so nothing else is asked.
 */
function useTransactionMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  budgetIdOf: (input: TInput, result: TResult) => string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      void invalidateBudget(queryClient, budgetIdOf(input, result));
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

export function useCreateTransaction() {
  return useTransactionMutation(
    createTransaction,
    (_, created) => created.budgetId,
  );
}

export function useUpdateTransaction() {
  return useTransactionMutation(
    updateTransaction,
    (_, updated) => updated.budgetId,
  );
}

/** Takes the whole row rather than its id: a deletion answers with nothing. */
export function useDeleteTransaction() {
  return useTransactionMutation(
    (transaction: Transaction) => deleteTransaction(transaction.id),
    (transaction) => transaction.budgetId,
  );
}

/**
 * Undo, which is a create carrying the id the deleted row had. Separate from
 * `useCreateTransaction` only so a screen can show the two states apart — a
 * restore in flight is not a new entry in flight.
 */
export function useRestoreTransaction() {
  return useTransactionMutation(
    createTransaction,
    (_, restored) => restored.budgetId,
  );
}
