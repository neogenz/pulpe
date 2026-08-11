import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import { fetchBudgetDetails, fetchBudgetPeriods } from "./budget-api";

export const budgetKeys = {
  all: ["budgets"] as const,
  periods: () => [...budgetKeys.all, "periods"] as const,
  detail: (budgetId: string) =>
    [...budgetKeys.all, "detail", budgetId] as const,
};

export function useBudgetPeriods() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: budgetKeys.periods(),
    queryFn: fetchBudgetPeriods,
    enabled: isVaultUnlocked,
  });
}

export function useBudgetDetails(budgetId: string | null) {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: budgetKeys.detail(budgetId ?? ""),
    queryFn: () => fetchBudgetDetails(budgetId as string),
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
