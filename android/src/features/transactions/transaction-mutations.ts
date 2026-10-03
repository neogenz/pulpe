import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Transaction, TransactionCreate } from "pulpe-shared";

import {
  type ApiError,
  isApiError,
  isTransientError,
} from "@/core/api/api-error";
import type { BudgetDetails } from "@/features/budgets/budget-api";
import {
  budgetKeys,
  invalidateAfterBudgetWrite,
} from "@/features/budgets/budget-queries";
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
  applyResult?: (queryClient: QueryClient, result: TResult) => void,
) {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterTransactionWrite();

  return useMutation({
    mutationFn,
    onSuccess: (result) => {
      applyResult?.(queryClient, result);
      refresh();
    },
  });
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
 * Failures marked rather than wrapped: the session and vault watchers read
 * the original error off the mutation cache.
 */
const unsavedCreates = new WeakSet<object>();

/**
 * A failed response may still have committed the write. Read back the chosen
 * id and confirm the submitted values before calling it a success. A 409 alone
 * does not prove that a changed retry was saved, and a goal withdrawal can
 * fail its balance check before the server even reaches the duplicate id.
 */
async function createOnce(payload: TransactionCreate): Promise<Transaction> {
  try {
    return await createTransaction(payload);
  } catch (error) {
    if (payload.id !== undefined) {
      try {
        const written = await fetchTransaction(payload.id);
        if (matchesSubmittedCreate(written, payload)) return written;
      } catch (readError) {
        // A read that also failed cannot confirm the write. Preserve the
        // original failure so the unchanged request remains retryable —
        // unless the server refused it and holds nothing under its id.
        if (
          isRefusal(error) &&
          isApiError(readError) &&
          readError.status === 404
        ) {
          unsavedCreates.add(error);
        }
      }
    }
    throw error;
  }
}

/**
 * Whether a failed create is known to have written nothing: the server
 * answered it with a refusal, and confirmed it holds no row under its id.
 * Anything else — a lost answer, a 5xx, a read-back that could not answer —
 * may still have landed.
 */
export function isUnsavedCreate(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && unsavedCreates.has(error)
  );
}

/** An answer from the server that turns the request down, not a breakdown. */
function isRefusal(error: unknown): error is ApiError {
  return (
    isApiError(error) &&
    error.status >= 400 &&
    error.status < 500 &&
    !isTransientError(error)
  );
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
  return useTransactionMutation(createOnce, addToBudgetDetails);
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
