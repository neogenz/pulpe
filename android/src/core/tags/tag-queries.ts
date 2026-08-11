import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";

import { createTag, fetchTags } from "./tag-api";

export const tagKeys = {
  all: ["tags"] as const,
};

/**
 * The user's whole tag list, which is small and changes rarely — every picker
 * reads this one query rather than fetching per form.
 */
export function useTags() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: tagKeys.all,
    queryFn: fetchTags,
    enabled: isVaultUnlocked,
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTag,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tagKeys.all }),
  });
}
