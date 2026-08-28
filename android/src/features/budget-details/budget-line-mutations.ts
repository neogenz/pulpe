import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";

import {
  createBudgetLine,
  deleteBudgetLine,
  postponeBudgetLine,
  updateBudgetLine,
} from "./budget-line-api";

export async function invalidateBudgetLineData(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
  ]);
}

/**
 * Every forecast write moves the month's totals, and a postpone moves two
 * months at once, so they all sweep the same prefix rather than each guessing
 * which cache entries went stale.
 *
 * None of them is optimistic: unlike pointing, these happen behind a form or a
 * confirmation the user is already waiting on, so there is no tap latency to
 * hide — and a rolled-back edit is far more confusing than a spinner.
 */
function useBudgetDataMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => invalidateBudgetLineData(queryClient),
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
