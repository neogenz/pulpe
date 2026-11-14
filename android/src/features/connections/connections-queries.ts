import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";

import {
  fetchConnectionActivity,
  fetchConnections,
  revokeConnection,
} from "./connections-api";

export const connectionKeys = {
  all: ["mcp-connections"] as const,
  activity: (id: string) => ["mcp-connections", id, "activity"] as const,
};

export function useConnections() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: connectionKeys.all,
    queryFn: fetchConnections,
    enabled: isVaultUnlocked,
  });
}

export function useConnectionActivity(id: string, isEnabled: boolean) {
  return useQuery({
    queryKey: connectionKeys.activity(id),
    queryFn: () => fetchConnectionActivity(id),
    enabled: isEnabled,
  });
}

/**
 * The server list is the only truth about who is still connected, so a cut is
 * followed by a reload rather than a local removal.
 */
export function useRevokeConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: revokeConnection,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: connectionKeys.all }),
  });
}
