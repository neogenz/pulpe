import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import type React from "react";

import { queryClient } from "@/core/query/query-client";
import { updateUserSettings } from "@/core/user-settings/user-settings-api";

import { useUpdateUserSettings } from "./account-queries";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("@/core/user-settings/user-settings-api", () => ({
  fetchUserSettings: jest.fn(),
  updateUserSettings: jest.fn(),
}));
jest.mock("./account-api", () => ({}));

// No cache time: a settled mutation kept for the default five minutes holds a
// timer that keeps Jest from exiting.
queryClient.setDefaultOptions({ mutations: { gcTime: 0 } });

it("refreshes what the old pay day answered, and keeps the new settings", async () => {
  const saved = { payDayOfMonth: 25, currency: "CHF" };
  jest.mocked(updateUserSettings).mockResolvedValue(saved as never);
  const invalidate = jest
    .spyOn(queryClient, "invalidateQueries")
    .mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useUpdateUserSettings(), { wrapper });

  await act(() => hook.result.current.mutateAsync({ payDayOfMonth: 25 }));

  expect(queryClient.getQueryData(["user-settings"])).toEqual(saved);
  const [{ predicate }] = invalidate.mock.calls[0] as [
    { predicate: (query: { queryKey: readonly unknown[] }) => boolean },
  ];
  expect(predicate({ queryKey: ["budgets", "periods", 2026] })).toBe(true);
  expect(predicate({ queryKey: ["savings-goals"] })).toBe(true);
  expect(predicate({ queryKey: ["user-settings"] })).toBe(false);

  invalidate.mockRestore();
  await hook.unmount();
  queryClient.clear();
});
