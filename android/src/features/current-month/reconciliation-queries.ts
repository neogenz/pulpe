import { useQuery } from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import { fetchReconciliationContext } from "./reconciliation-api";

/** A check anywhere moves the previous months' correction: `useToggleCheck` invalidates `all`. */
export const reconciliationKeys = {
  all: ["reconciliation"] as const,
  context: (budgetId: string) =>
    [...reconciliationKeys.all, "context", budgetId] as const,
};

/** Read for step 2 only; values are decrypted server-side, so not before the vault is open. */
export function useReconciliationContext(budgetId: string, isWanted: boolean) {
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: reconciliationKeys.context(budgetId),
    queryFn: () => fetchReconciliationContext(budgetId),
    enabled: isUnlocked && isWanted,
  });
}

/**
 * Each « Comparer » waits for a read of its own rather than a cached one: an
 * item checked elsewhere since moves the correction.
 */
export function forgetReconciliationContext(budgetId: string): void {
  queryClient.removeQueries({
    queryKey: reconciliationKeys.context(budgetId),
    exact: true,
  });
}
