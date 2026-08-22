import { useQuery } from "@tanstack/react-query";
import type { UserSettings } from "pulpe-shared";

import { queryClient } from "@/core/query/query-client";
import { useVaultStore } from "@/core/vault/vault-store";

import { fetchUserSettings } from "./user-settings-api";

export const userSettingsKeys = {
  all: ["user-settings"] as const,
};

export function cacheUserSettings(settings: UserSettings): void {
  queryClient.setQueryData(userSettingsKeys.all, settings);
  void queryClient.invalidateQueries();
}

/**
 * The pay day here decides which budget counts as "the current one", so every
 * screen that resolves a period reads it from this single query rather than
 * carrying its own copy.
 */
export function useUserSettings() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: userSettingsKeys.all,
    queryFn: fetchUserSettings,
    enabled: isVaultUnlocked,
  });
}

export function invalidateUserSettings(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: userSettingsKeys.all });
}
