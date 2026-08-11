import { useQuery } from "@tanstack/react-query";

import { useVaultStore } from "@/core/vault/vault-store";

import { fetchTemplates } from "./template-api";

export const templateKeys = {
  all: ["templates"] as const,
};

export function useTemplates() {
  const isVaultUnlocked = useVaultStore((state) => state.status === "unlocked");

  return useQuery({
    queryKey: templateKeys.all,
    queryFn: fetchTemplates,
    enabled: isVaultUnlocked,
  });
}
