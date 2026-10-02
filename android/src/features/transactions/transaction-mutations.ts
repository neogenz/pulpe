import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  API_ERROR_CODES,
  type Transaction,
  type TransactionCreate,
} from "pulpe-shared";

import { isApiError } from "@/core/api/api-error";

import { invalidateAfterBudgetWrite } from "@/features/budgets/budget-queries";
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
 * carries, the carry-over of the months after it, and the goals it may count
 * towards.
 */
function useTransactionMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void invalidateAfterBudgetWrite(queryClient);
      void queryClient.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/**
 * The same id twice is the same operation. A retry after an answer lost on
 * the way back — a timeout, the network dropping — finds the first attempt
 * already written, and that is the success it was asking for; without the id,
 * it wrote the operation a second time.
 */
async function createOnce(payload: TransactionCreate): Promise<void> {
  try {
    await createTransaction(payload);
  } catch (error) {
    const isAlreadyWritten =
      payload.id !== undefined &&
      isApiError(error) &&
      error.code === API_ERROR_CODES.TRANSACTION_ALREADY_EXISTS;
    if (!isAlreadyWritten) throw error;
  }
}

export function useCreateTransaction() {
  return useTransactionMutation(createOnce);
}

export function useUpdateTransaction() {
  return useTransactionMutation(updateTransaction);
}

/** Takes the whole row rather than its id, as the undo restores it whole. */
export function useDeleteTransaction() {
  return useTransactionMutation((transaction: Transaction) =>
    deleteTransaction(transaction.id),
  );
}

/**
 * Undo, which is a create carrying the id the deleted row had. Separate from
 * `useCreateTransaction` only so a screen can show the two states apart — a
 * restore in flight is not a new entry in flight.
 */
export function useRestoreTransaction() {
  return useTransactionMutation(createOnce);
}
