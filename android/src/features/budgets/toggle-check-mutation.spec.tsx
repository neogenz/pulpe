import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";

import { budgetKeys } from "./budget-queries";
import { useToggleCheck } from "./toggle-check-mutation";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("./budget-api", () => ({}));
jest.mock("./toggle-check-api", () => ({
  toggleCheck: jest.fn(async () => undefined),
}));

/** A pointing tap refreshes the month it happened in, and nothing else now. */
it("settles on the budget it pointed in, not on the whole prefix", async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const invalidate = jest
    .spyOn(client, "invalidateQueries")
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useToggleCheck("budget-1"), { wrapper });

  await act(() =>
    hook.result.current.mutate({ source: "budgetLine", sourceId: "rent" }),
  );

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(invalidate.mock.calls.map(([options]) => options)).toEqual([
    { queryKey: budgetKeys.detail("budget-1") },
    { queryKey: budgetKeys.list(), refetchType: "none" },
  ]);
  await hook.unmount();
  client.clear();
});
