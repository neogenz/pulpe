import type { ReconciliationContext } from "pulpe-shared";
import { useMutation, useQuery } from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  fetchReconciliationContext,
  writeReconciliationState,
} from "./reconciliation-api";

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

/**
 * One write per answer. Accepted, the comparison reads the stored state at
 * once; refused, it reads the context again, since the write may have landed.
 */
export function useWriteReconciliationState(budgetId: string) {
  const key = reconciliationKeys.context(budgetId);
  return useMutation({
    mutationFn: writeReconciliationState,
    onSuccess: async (state) => {
      // A read already out holds the state from before this write: it must not land after it.
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<ReconciliationContext>(key, (context) =>
        context === undefined ? context : { ...context, ...state },
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
