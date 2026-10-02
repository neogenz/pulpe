import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { invalidateAfterBudgetWrite } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createBudgetLine,
  deleteBudgetLine,
  postponeBudgetLine,
  updateBudgetLine,
} from "./budget-line-api";

/**
 * A forecast write moves its month's totals, the carry-over of the months
 * after it and, when the line belongs to a goal, the goal's progress.
 */
export async function invalidateBudgetLines(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    invalidateAfterBudgetWrite(queryClient),
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
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => invalidateBudgetLines(queryClient),
  });
}

export function useCreateBudgetLine() {
  return useBudgetDataMutation(createBudgetLine);
}

export function useUpdateBudgetLine() {
  return useBudgetDataMutation(updateBudgetLine);
}

export function useDeleteBudgetLine() {
  return useBudgetDataMutation(deleteBudgetLine);
}

export function usePostponeBudgetLine() {
  return useBudgetDataMutation(postponeBudgetLine);
}
