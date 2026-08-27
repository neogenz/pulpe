import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";
import { budgetKeys } from "@/features/budgets/budget-queries";

import { createTag, deleteTag, fetchTags, renameTag } from "./tag-api";

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
  return useTagMutation(createTag);
}

export function useRenameTag() {
  return useTagMutation(renameTag);
}

export function useDeleteTag() {
  return useTagMutation(deleteTag);
}

/**
 * Tags are shown on forecasts and operations, so a rename or a removal has to
 * reach the budget trees too, not just the list. A tag can sit on any month's
 * rows: every detail on screen refetches, the rest and the budget list wait
 * for their next focus.
 */
function useTagMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: tagKeys.all });
      void queryClient.invalidateQueries({ queryKey: budgetKeys.details() });
      void queryClient.invalidateQueries({
        queryKey: budgetKeys.list(),
        refetchType: "none",
      });
    },
  });
}
