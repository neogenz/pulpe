import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { budgetKeys } from "@/features/budgets/budget-queries";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  createSpread,
  fetchSpreadOccurrences,
  spreadExistingLine,
} from "./spread-api";

export const spreadKeys = {
  all: ["spread"] as const,
  occurrences: (groupId: string) => ["spread", "occurrences", groupId] as const,
};

/**
 * A spread writes into several months at once, so both mutations sweep the
 * whole budget prefix rather than naming the entries they touched — the months
 * the server had to create along the way are not knowable from here.
 */
function useSpreadMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      void queryClient.invalidateQueries({ queryKey: spreadKeys.all });
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
