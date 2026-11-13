import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";

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

export const netWorthKeys = {
  all: ["net-worth"] as const,
};

/** Values are decrypted server-side: no read before the vault is open. */
export function useNetWorth() {
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: netWorthKeys.all,
    queryFn: fetchNetWorth,
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

export function useDismissAssetSuggestion() {
  return useNetWorthMutation(dismissAssetSuggestion);
}

export function useCreateAssetCategory() {
  return useNetWorthMutation(createAssetCategory);
}

export function useRenameAssetCategory() {
  return useNetWorthMutation(renameAssetCategory);
}
