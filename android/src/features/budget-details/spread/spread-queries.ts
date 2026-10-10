import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";
import { goalKeys } from "@/features/savings-goals/goals-queries";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  createSpread,
  fetchSpreadOccurrences,
  spreadExistingLine,
} from "./spread-api";

// Under the budget details, so pointing or editing one month of a spread
// refreshes the tracker with the month itself.
export const spreadKeys = {
  occurrences: (groupId: string) =>
    [...budgetKeys.details(), "spread-occurrences", groupId] as const,
};

/**
 * A spread writes into several months at once, so both mutations sweep the
 * whole budget prefix rather than going through `invalidateAfterBudgetWrite`
 * — the months the server had to create along the way are new list entries
 * and new periods. A goal-linked line hands its goal to every part, so the goal
 * pages are swept too.
 */
function useSpreadMutation<TInput, TResult>(
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

export function useCreateSpread() {
  return useSpreadMutation(createSpread);
}

export function useSpreadExistingLine() {
  return useSpreadMutation(spreadExistingLine);
}

export function useSpreadOccurrences(spreadGroupId: string | null) {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: spreadKeys.occurrences(spreadGroupId ?? "none"),
    queryFn: () => fetchSpreadOccurrences(spreadGroupId as string),
    enabled: spreadGroupId !== null && isVaultUnlocked,
  });
}
