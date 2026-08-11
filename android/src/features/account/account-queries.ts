import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { updateUserSettings } from "@/core/user-settings/user-settings-api";
import { userSettingsKeys } from "@/core/user-settings/user-settings-queries";
import { useVaultStore } from "@/core/vault/vault-store";

import {
  deleteAccount,
  fetchUserProfile,
  updateUserProfile,
} from "./account-api";

export const accountKeys = {
  profile: ["account", "profile"] as const,
};

/**
 * The profile is not encrypted, but it is only reachable once authenticated —
 * and every screen that shows it sits behind the vault anyway.
 */
export function useUserProfile() {
  const isUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: accountKeys.profile,
    queryFn: fetchUserProfile,
    enabled: isUnlocked,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserProfile,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: accountKeys.profile }),
  });
}

/**
 * The pay day decides which budget is "the current one" and the currency
 * decides how every amount reads, so a change to either invalidates the whole
 * cache rather than the settings alone.
 */
export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(userSettingsKeys.all, settings);
      void queryClient.invalidateQueries();
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: deleteAccount });
}
