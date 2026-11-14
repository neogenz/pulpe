import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type React from "react";

import { revokeConnection } from "./connections-api";
import { connectionKeys, useRevokeConnection } from "./connections-queries";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("./connections-api", () => ({
  fetchConnectionActivity: jest.fn(),
  fetchConnections: jest.fn(),
  revokeConnection: jest.fn(),
}));

it("reloads the server list after a cut instead of trusting a local removal", async () => {
  jest.mocked(revokeConnection).mockResolvedValue(undefined);
  const client = new QueryClient({
    defaultOptions: { mutations: { gcTime: 0 } },
  });
  const invalidate = jest
    .spyOn(client, "invalidateQueries")
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useRevokeConnection(), { wrapper });

  await act(() => hook.result.current.mutateAsync("connection-1"));

  expect(jest.mocked(revokeConnection).mock.calls[0][0]).toBe("connection-1");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: connectionKeys.all });
});
