import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";

import type { BudgetDetails } from "./budget-api";
import { budgetKeys } from "./budget-queries";
import { toggleCheck, type CheckTarget } from "./toggle-check-api";
import { useToggleCheck } from "./toggle-check-mutation";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("./budget-api", () => ({}));
jest.mock("./toggle-check-api", () => ({
  toggleCheck: jest.fn(async () => undefined),
}));

/** A pointing tap refreshes the month it happened in, and nothing else now. */
it("settles on the budget it pointed in, not on the whole prefix", async () => {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: Infinity },
      queries: { retry: false },
    },
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

describe("a failed toggle", () => {
  const detailKey = budgetKeys.detail("budget-1");
  const pending = new Map<
    string,
    { resolve: () => void; reject: (error: Error) => void }
  >();
  let client: QueryClient;

  beforeEach(() => {
    pending.clear();
    jest
      .mocked(toggleCheck)
      .mockImplementation(
        (target: CheckTarget) =>
          new Promise<void>((resolve, reject) =>
            pending.set(target.sourceId, { resolve, reject }),
          ),
      );
    client = new QueryClient({
      defaultOptions: {
        mutations: { retry: false, gcTime: Infinity },
        queries: { retry: false, gcTime: Infinity },
      },
    });
    // The settle refetch is a different concern; here it would only race the
    // cache this test reads.
    jest.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
    client.setQueryData(detailKey, {
      budget: {},
      transactions: [],
      budgetLines: [
        { id: "A", checkedAt: null },
        { id: "B", checkedAt: null },
      ],
    } as unknown as BudgetDetails);
  });

  afterEach(() => {
    jest.mocked(toggleCheck).mockReset();
    client.clear();
  });

  const pointed = () =>
    client
      .getQueryData<BudgetDetails>(detailKey)
      ?.budgetLines.map(
        (line) => `${line.id}:${line.checkedAt === null ? "open" : "pointed"}`,
      )
      .join(" ");

  async function renderToggle() {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useToggleCheck("budget-1"), { wrapper });
  }

  async function settle() {
    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("puts back its own row and leaves a row pointed since alone", async () => {
    const hook = await renderToggle();

    await act(async () => {
      hook.result.current.mutate({ source: "budgetLine", sourceId: "A" });
      await settle();
      hook.result.current.mutate({ source: "budgetLine", sourceId: "B" });
      await settle();
    });
    expect(pointed()).toBe("A:pointed B:pointed");

    await act(async () => {
      pending.get("A")?.reject(new Error("500"));
      await settle();
    });
    expect(pointed()).toBe("A:open B:pointed");

    await act(async () => {
      pending.get("B")?.resolve();
      await settle();
    });
    expect(pointed()).toBe("A:open B:pointed");
    await hook.unmount();
  });

  it("leaves a row alone once a refetch has replaced what it wrote", async () => {
    const hook = await renderToggle();

    await act(async () => {
      hook.result.current.mutate({ source: "budgetLine", sourceId: "A" });
      await settle();
    });
    const serverStamp = "2026-09-01T08:00:00.000Z";
    client.setQueryData<BudgetDetails>(detailKey, (details) =>
      details === undefined
        ? details
        : {
            ...details,
            budgetLines: details.budgetLines.map((line) =>
              line.id === "A" ? { ...line, checkedAt: serverStamp } : line,
            ),
          },
    );

    await act(async () => {
      pending.get("A")?.reject(new Error("500"));
      await settle();
    });

    expect(
      client
        .getQueryData<BudgetDetails>(detailKey)
        ?.budgetLines.find((line) => line.id === "A")?.checkedAt,
    ).toBe(serverStamp);
    await hook.unmount();
  });
});
