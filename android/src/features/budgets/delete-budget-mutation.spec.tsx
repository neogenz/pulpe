import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";
import { goalKeys } from "@/features/savings-goals/goals-queries";
import { templateKeys } from "@/features/templates/template-queries";

import { budgetKeys } from "./budget-queries";
import { useDeleteBudget } from "./delete-budget-mutation";

jest.mock("@/core/api/api", () => ({
  api: { deleteVoid: jest.fn(async () => undefined) },
}));
// The key factories are the real ones; the vault store only drags in native crypto.
jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: jest.fn() }));

const mockedDeleteVoid = jest.mocked(api.deleteVoid);

async function setup() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const seeded = {
    list: budgetKeys.list(),
    periods: budgetKeys.periods(2026),
    deletedDetail: budgetKeys.detail("budget-1"),
    deletedImpact: [...budgetKeys.detail("budget-1"), "deletion-impact"],
    otherDetail: budgetKeys.detail("budget-2"),
    goals: goalKeys.list(),
    templateUsage: templateKeys.usage("template-1"),
  };
  for (const key of Object.values(seeded)) client.setQueryData(key, {});
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useDeleteBudget("budget-1"), { wrapper });
  const isInvalidated = (key: readonly unknown[]) =>
    client.getQueryState(key)?.isInvalidated;
  return { client, hook, seeded, isInvalidated };
}

beforeEach(() => jest.clearAllMocks());

it.each([true, false])(
  "deletes the budget carrying confirmLinks %s as a query flag",
  async (confirmLinks) => {
    const { client, hook } = await setup();

    await act(() => hook.result.current.mutateAsync(confirmLinks));

    expect(mockedDeleteVoid).toHaveBeenCalledWith(
      ENDPOINTS.budget("budget-1"),
      {
        confirmLinks,
      },
    );
    await hook.unmount();
    client.clear();
  },
);

it("sweeps the list, periods, other details, goals and template usage but spares the deleted detail", async () => {
  const { client, hook, seeded, isInvalidated } = await setup();

  await act(() => hook.result.current.mutateAsync(false));

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(isInvalidated(seeded.list)).toBe(true);
  expect(isInvalidated(seeded.periods)).toBe(true);
  expect(isInvalidated(seeded.otherDetail)).toBe(true);
  expect(isInvalidated(seeded.goals)).toBe(true);
  expect(isInvalidated(seeded.templateUsage)).toBe(true);
  expect(isInvalidated(seeded.deletedDetail)).toBe(false);
  expect(isInvalidated(seeded.deletedImpact)).toBe(false);
  await hook.unmount();
  client.clear();
});

it("invalidates nothing when the delete is refused", async () => {
  mockedDeleteVoid.mockRejectedValueOnce(new Error("409"));
  const { client, hook, seeded, isInvalidated } = await setup();

  await act(() => hook.result.current.mutateAsync(false).catch(() => null));

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(isInvalidated(seeded.list)).toBe(false);
  expect(isInvalidated(seeded.goals)).toBe(false);
  await hook.unmount();
  client.clear();
});
