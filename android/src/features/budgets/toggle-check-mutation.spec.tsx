import {
  QueryClient,
  QueryClientProvider,
  QueryObserver,
} from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type React from "react";

import { goalKeys } from "@/features/savings-goals/goals-queries";

import type { BudgetDetails } from "./budget-api";
import { budgetKeys } from "./budget-queries";
import { toggleCheck, type CheckTarget } from "./toggle-check-api";
import { useToggleCheck } from "./toggle-check-mutation";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("./budget-api", () => ({}));
jest.mock("@/features/savings-goals/goals-api", () => ({}));
jest.mock("./toggle-check-api", () => ({
  toggleCheck: jest.fn(async () => undefined),
}));

/**
 * A pointing tap refreshes the months on screen — the carry-over of every
 * later month moved with it — and the goals, whose saved amount is their
 * pointed lines. The list and the periods stay where they are.
 */
it("settles on the budget details and the goals, not on the whole prefix", async () => {
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
    { queryKey: budgetKeys.details() },
    { queryKey: budgetKeys.list(), refetchType: "none" },
    { queryKey: goalKeys.all },
  ]);
  await hook.unmount();
  client.clear();
});

describe("reconciliation with other taps pending", () => {
  const serverStamp = "2026-10-01T12:00:00.000Z";
  let client: QueryClient;
  let hook: Awaited<ReturnType<typeof renderToggles>>;
  const server = new Map<string, string | null>();
  const reads: string[] = [];
  const subscriptions: (() => void)[] = [];
  const pending: { succeed: () => void; fail: () => void }[] = [];

  function details(budgetId: string): BudgetDetails {
    return {
      budget: {},
      transactions: [],
      budgetLines: (budgetId === "budget-1" ? ["A", "B"] : ["C"]).map((id) => ({
        id,
        checkedAt: server.get(id) ?? null,
      })),
    } as unknown as BudgetDetails;
  }

  function renderToggles() {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(
      () => ({
        first: useToggleCheck("budget-1"),
        second: useToggleCheck("budget-2"),
      }),
      { wrapper },
    );
  }

  const local = (id: string) =>
    client
      .getQueryData<BudgetDetails>(
        budgetKeys.detail(id === "C" ? "budget-2" : "budget-1"),
      )
      ?.budgetLines.find((line) => line.id === id)?.checkedAt;

  async function tap(id: string) {
    const mutation =
      id === "C" ? hook.result.current.second : hook.result.current.first;
    const expectedRequests = pending.length + 1;
    await act(() => mutation.mutate({ source: "budgetLine", sourceId: id }));
    await waitFor(() => expect(pending).toHaveLength(expectedRequests));
  }

  async function expectPending(count: number) {
    await waitFor(() =>
      expect(client.isMutating({ mutationKey: ["toggle-check"] })).toBe(count),
    );
  }

  beforeEach(async () => {
    reads.length = 0;
    pending.length = 0;
    server.clear();
    for (const id of ["A", "B", "C"]) server.set(id, null);
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    jest.mocked(toggleCheck).mockImplementation(
      (target) =>
        new Promise<void>((resolve, reject) => {
          pending.push({
            succeed: () => {
              server.set(
                target.sourceId,
                server.get(target.sourceId) === null ? serverStamp : null,
              );
              resolve();
            },
            fail: () => reject(new Error("500")),
          });
        }),
    );
    // Real, active observers: an invalidation must actually fetch and replace
    // optimistic rows, which mocking invalidateQueries would hide.
    for (const budgetId of ["budget-1", "budget-2"]) {
      const queryKey = budgetKeys.detail(budgetId);
      client.setQueryData(queryKey, details(budgetId));
      const observer = new QueryObserver(client, {
        queryKey,
        queryFn: async () => {
          reads.push(budgetId);
          return details(budgetId);
        },
        staleTime: Infinity,
      });
      subscriptions.push(observer.subscribe(() => undefined));
    }
    client.setQueryData(goalKeys.all, 0);
    const goals = new QueryObserver(client, {
      queryKey: goalKeys.all,
      queryFn: async () => {
        reads.push("goals");
        return [...server.values()].filter((stamp) => stamp !== null).length;
      },
      staleTime: Infinity,
    });
    subscriptions.push(goals.subscribe(() => undefined));
    hook = await renderToggles();
  });

  afterEach(async () => {
    await hook.unmount();
    for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
    client.clear();
    jest.mocked(toggleCheck).mockReset();
  });

  it.each([
    ["the same row", "A"],
    ["another row", "B"],
    ["another budget", "C"],
  ])(
    "keeps the later intent on %s until both requests finish",
    async (_, id) => {
      await tap("A");
      await tap(id);
      const laterIntent = local(id);

      await act(() => pending[0].succeed());
      await expectPending(1);

      expect(reads).toEqual([]);
      expect(local(id)).toBe(laterIntent);

      await act(() => pending[1].succeed());
      await expectPending(0);

      expect(local(id)).toBe(server.get(id));
      expect(reads.sort()).toEqual(["budget-1", "budget-2", "goals"]);
    },
  );

  it("reconciles once when both requests finish together", async () => {
    await tap("A");
    await tap("B");

    await act(() => {
      pending[0].succeed();
      pending[1].succeed();
    });
    await expectPending(0);

    expect(reads.sort()).toEqual(["budget-1", "budget-2", "goals"]);
    expect(local("A")).toBe(serverStamp);
    expect(local("B")).toBe(serverStamp);
  });

  it("rolls back a failed row while preserving another pending row", async () => {
    await tap("A");
    await tap("B");
    const laterIntent = local("B");

    await act(() => pending[0].fail());
    await expectPending(1);

    expect(local("A")).toBeNull();
    expect(local("B")).toBe(laterIntent);
    expect(reads).toEqual([]);

    await act(() => pending[1].succeed());
    await expectPending(0);

    expect(local("A")).toBeNull();
    expect(local("B")).toBe(serverStamp);
    expect(reads.sort()).toEqual(["budget-1", "budget-2", "goals"]);
  });

  it("does not mistake a later unpointing for an older failed unpointing", async () => {
    for (let index = 0; index < 4; index += 1) await tap("A");
    expect(local("A")).toBeNull();

    await act(() => pending[1].fail());
    await expectPending(3);

    expect(local("A")).toBeNull();
    expect(reads).toEqual([]);

    await act(() => {
      pending[0].succeed();
      pending[2].succeed();
      pending[3].succeed();
    });
    await expectPending(0);

    expect(local("A")).toBe(serverStamp);
    expect(reads.sort()).toEqual(["budget-1", "budget-2", "goals"]);
  });
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
