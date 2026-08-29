import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { invalidateBudget } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createBudgetLine,
  deleteBudgetLine,
  postponeBudgetLine,
  updateBudgetLine,
} from "./budget-line-api";

/**
 * A forecast write moves its month's totals and, when the line belongs to a
 * goal, the goal's progress: the budgets it names refetch, the goals sweep.
 */
export async function invalidateBudgetLines(
  queryClient: QueryClient,
  budgetIds: readonly string[],
): Promise<void> {
  await Promise.all([
    ...budgetIds.map((budgetId) => invalidateBudget(queryClient, budgetId)),
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
  ]);
}

/**
 * None of these is optimistic: unlike pointing, they happen behind a form or a
 * confirmation the user is already waiting on, so there is no tap latency to
 * hide — and a rolled-back edit is far more confusing than a spinner.
 */
function useBudgetDataMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  budgetIdsOf: (input: TInput, result: TResult) => readonly string[],
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (result, input) =>
      invalidateBudgetLines(queryClient, budgetIdsOf(input, result)),
  });
}

export function useCreateBudgetLine() {
  return useBudgetDataMutation(createBudgetLine, (_, line) => [line.budgetId]);
}

export function useUpdateBudgetLine() {
  return useBudgetDataMutation(updateBudgetLine, (_, line) => [line.budgetId]);
}

/** The budget is the hook's, not the call's: a deletion answers with nothing. */
export function useDeleteBudgetLine(budgetId: string) {
  return useBudgetDataMutation(deleteBudgetLine, () => [budgetId]);
}

export function usePostponeBudgetLine() {
  return useBudgetDataMutation(postponeBudgetLine, (_, moved) => [
    moved.sourceBudgetId,
    moved.targetBudgetId,
  ]);
}
