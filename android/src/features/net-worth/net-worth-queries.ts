import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { NetWorth } from "pulpe-shared";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import { followAccounts, type FollowAccountsInput } from "./follow-accounts";
import {
  createAsset,
  createAssetCategory,
  deleteAsset,
  dismissAssetSuggestion,
  fetchNetWorth,
  recordAssetSnapshots,
  renameAssetCategory,
  updateAsset,
} from "./net-worth-api";
import { netWorthKeys } from "./net-worth-keys";

export { netWorthKeys };

/** Silent when nothing went stale: a budget write only marks this read stale. */
export function refetchStaleNetWorth(): Promise<void> {
  return queryClient.refetchQueries({
    queryKey: netWorthKeys.all,
    stale: true,
    type: "active",
  });
}

/** Values are decrypted server-side: no read before the vault is open. */
export function useNetWorth(isWanted = true) {
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: netWorthKeys.all,
    queryFn: fetchNetWorth,
    enabled: isUnlocked && isWanted,
  });
}

/** One read carries totals, Types and assets, so every write refreshes it whole. */
function useNetWorthMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: netWorthKeys.all }),
  });
}

export function useCreateAsset() {
  return useNetWorthMutation(createAsset);
}

export function useUpdateAsset() {
  return useNetWorthMutation(updateAsset);
}

export function useDeleteAsset() {
  return useNetWorthMutation(deleteAsset);
}

export function useRecordAssetSnapshots() {
  return useNetWorthMutation(recordAssetSnapshots);
}

export function useDismissAssetSuggestion() {
  return useNetWorthMutation(dismissAssetSuggestion);
}

export function useCreateAssetCategory() {
  return useNetWorthMutation(createAssetCategory);
}

export function useRenameAssetCategory() {
  return useNetWorthMutation(renameAssetCategory);
}

/** New accounts land in a Type read from the cache: a reconciliation loads it first. */
export function useFollowAccounts() {
  return useNetWorthMutation((input: FollowAccountsInput) =>
    followAccounts(
      input,
      queryClient.getQueryData<NetWorth>(netWorthKeys.all)?.categories ?? [],
    ),
  );
}
