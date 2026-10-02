import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Transaction, TransactionCreate } from "pulpe-shared";

import { invalidateAfterBudgetWrite } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createTransaction,
  deleteTransaction,
  fetchTransaction,
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
  const refresh = useRefreshAfterTransactionWrite();

  return useMutation({ mutationFn, onSuccess: refresh });
}

/**
 * Also for a create abandoned after a failure: its write may have landed, and
 * a budget still showing the old rows invites the user to enter it again.
 */
export function useRefreshAfterTransactionWrite(): () => void {
  const queryClient = useQueryClient();

  return () => {
    void invalidateAfterBudgetWrite(queryClient);
    void queryClient.invalidateQueries({ queryKey: goalKeys.all });
  };
}

/**
 * A failed response may still have committed the write. Read back the chosen
 * id and confirm the submitted values before calling it a success. A 409 alone
 * does not prove that a changed retry was saved, and a goal withdrawal can
 * fail its balance check before the server even reaches the duplicate id.
 */
async function createOnce(payload: TransactionCreate): Promise<void> {
  try {
    await createTransaction(payload);
  } catch (error) {
    if (payload.id !== undefined) {
      try {
        const written = await fetchTransaction(payload.id);
        if (matchesSubmittedCreate(written, payload)) return;
      } catch {
        // A read that also failed cannot confirm the write. Preserve the
        // original failure so the unchanged request remains retryable.
      }
    }
    throw error;
  }
}

function matchesSubmittedCreate(
  written: Transaction,
  payload: TransactionCreate,
): boolean {
  const allocated = payload.budgetLineId != null;
  const inheritedWithdrawal =
    allocated &&
    (written.sourceSavingsGoalId != null ||
      written.sourceSavingsGoalName != null);
  const writtenTags = (written.tagIds ?? []).slice().sort();
  const submittedTags = (payload.tagIds ?? []).slice().sort();
  // The server owns the rate and clears incomplete/same-currency source FX
  // metadata. Compare the intent it persists, not an untrusted client rate.
  const hasFxPair =
    payload.originalCurrency !== undefined &&
    payload.targetCurrency !== undefined &&
    payload.originalCurrency !== payload.targetCurrency;

  return (
    written.id === payload.id &&
    written.budgetId === payload.budgetId &&
    written.budgetLineId === (payload.budgetLineId ?? null) &&
    written.name === payload.name.trim() &&
    written.amount === payload.amount &&
    written.kind === payload.kind &&
    (payload.transactionDate === undefined ||
      Date.parse(written.transactionDate) ===
        Date.parse(payload.transactionDate)) &&
    (written.checkedAt !== null) ===
      (inheritedWithdrawal || payload.checkedAt != null) &&
    (allocated ||
      ((written.sourceSavingsGoalId ?? null) ===
        (payload.sourceSavingsGoalId ?? null) &&
        (payload.sourceSavingsGoalId !== undefined ||
          written.sourceSavingsGoalName == null))) &&
    writtenTags.length === submittedTags.length &&
    submittedTags.every((id, index) => writtenTags[index] === id) &&
    (written.originalAmount ?? null) ===
      (hasFxPair ? (payload.originalAmount ?? null) : null) &&
    (written.originalCurrency ?? null) ===
      (hasFxPair ? payload.originalCurrency : null) &&
    (written.targetCurrency ?? null) === (payload.targetCurrency ?? null)
  );
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
