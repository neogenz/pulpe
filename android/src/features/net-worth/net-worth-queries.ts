import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import { followAccounts } from "./follow-accounts";
import {
  createAsset,
  createAssetCategory,
  deleteAsset,
  fetchAssetHistory,
  fetchNetWorth,
  recordAssetSnapshots,
  renameAssetCategory,
  updateAsset,
} from "./net-worth-api";
import { netWorthKeys } from "./net-worth-keys";

export { netWorthKeys };

/**
 * Silent when nothing went stale: a budget write only marks this read stale.
 * A read already under way is joined, not restarted: a screen opening fetches
 * and asks again on focus in the same breath.
 */
export function refetchStaleNetWorth(): Promise<void> {
  return queryClient.refetchQueries(
    {
      queryKey: netWorthKeys.all,
      stale: true,
      type: "active",
    },
    { cancelRefetch: false },
  );
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

/**
 * An element and its history, page by page. The element comes with every page;
 * the first one is the freshest, since a refetch reloads the pages in order.
 */
export function useAssetHistory(assetId: string) {
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useInfiniteQuery({
    queryKey: netWorthKeys.history(assetId),
    queryFn: ({ pageParam }) => fetchAssetHistory(assetId, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: isUnlocked,
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

export function useCreateAssetCategory() {
  return useNetWorthMutation(createAssetCategory);
}

export function useRenameAssetCategory() {
  return useNetWorthMutation(renameAssetCategory);
}

export function useFollowAccounts() {
  return useNetWorthMutation(followAccounts);
}
