import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import { fetchBudgetDetails, fetchBudgetList } from "./budget-api";

export const budgetKeys = {
  all: ["budgets"] as const,
  list: () => [...budgetKeys.all, "list"] as const,
  detail: (budgetId: string) =>
    [...budgetKeys.all, "detail", budgetId] as const,
};

export function useBudgetList() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: budgetKeys.list(),
    queryFn: fetchBudgetList,
    enabled: isVaultUnlocked,
  });
}

export function useBudgetDetails(budgetId: string | null) {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: budgetKeys.detail(budgetId ?? ""),
    // Narrowed rather than asserted: `enabled` already keeps this from running
    // without an id, and a cast would go on compiling if that guard moved.
    queryFn: () =>
      budgetId === null
        ? Promise.reject(new Error("No budget to load"))
        : fetchBudgetDetails(budgetId),
    enabled: isVaultUnlocked && budgetId !== null,
  });
}

/**
 * The single sweep every budget-data mutation and every pull-to-refresh goes
 * through. A budget line write moves its own budget's totals, a postpone moves
 * two budgets, and a spread moves a whole group — enumerating the affected keys
 * at each call site is how one of them ends up forgotten, so the prefix takes
 * them all.
 */
export function invalidateBudgetData(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: budgetKeys.all });
}
