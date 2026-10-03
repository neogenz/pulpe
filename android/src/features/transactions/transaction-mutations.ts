import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Transaction } from "pulpe-shared";

import type { BudgetDetails } from "@/features/budgets/budget-api";
import {
  budgetKeys,
  invalidateBudget,
} from "@/features/budgets/budget-queries";
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
  applyResult?: (queryClient: QueryClient, result: TResult) => void,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result, input) => {
      applyResult?.(queryClient, result);
      void invalidateBudget(queryClient, budgetIdOf(input, result));
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/**
 * The row the server answered with goes into its month at once, ahead of the
 * refetch: the home screen's realized balance and activity read that cache,
 * and a refetch that lags or fails would otherwise leave a write that happened
 * looking as if it had not — the surest way to have it written twice.
 */
function addToBudgetDetails(queryClient: QueryClient, created: Transaction) {
  queryClient.setQueryData<BudgetDetails>(
    budgetKeys.detail(created.budgetId),
    (details) =>
      details === undefined ||
      details.transactions.some((row) => row.id === created.id)
        ? details
        : { ...details, transactions: [...details.transactions, created] },
  );
}

export function useCreateTransaction() {
  return useTransactionMutation(
    createTransaction,
    (_, created) => created.budgetId,
    addToBudgetDetails,
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
