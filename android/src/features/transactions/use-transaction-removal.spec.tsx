import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react-native";
import type { Transaction } from "pulpe-shared";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { MD3LightTheme, PaperProvider } from "react-native-paper";

import { Notice } from "@/core/ui/notice";

import { useTransactionRemoval } from "./use-transaction-removal";

interface Pending {
  resolve: () => void;
  reject: (error: Error) => void;
}

const mockDeletions = new Map<string, Pending>();
const mockRestores: { id: string; pending: Pending }[] = [];

function mockSettleable(record: (pending: Pending) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => record({ resolve, reject }));
}

jest.mock("./transaction-api", () => ({
  updateTransaction: jest.fn(),
  deleteTransaction: (id: string) =>
    mockSettleable((pending) => mockDeletions.set(id, pending)),
  createTransaction: async (payload: { id: string; budgetId: string }) => {
    await mockSettleable((pending) =>
      mockRestores.push({ id: payload.id, pending }),
    );
    return payload;
  },
}));
jest.mock("@/features/budgets/budget-queries", () => ({
  invalidateBudget: jest.fn(async () => undefined),
}));
jest.mock("@/features/savings-goals/goals-queries", () => ({
  goalKeys: { all: ["savings-goals"] },
}));

const transaction = (id: string) =>
  ({
    id,
    name: id,
    budgetId: "budget-1",
    amount: 10,
    kind: "expense",
    transactionDate: "2026-09-01T10:00:00.000Z",
    checkedAt: null,
    budgetLineId: null,
  }) as unknown as Transaction;

let removal: ReturnType<typeof useTransactionRemoval>;

/** Wired the way both detail overlays wire it, with the real Paper Snackbar. */
function Harness() {
  const current = useTransactionRemoval();
  // Handed out after each commit, so the test drives the latest closures.
  useEffect(() => {
    removal = current;
  });

  return (
    <View>
      <Text>{`stack:${current.undoable.map((entry) => entry.id).join(",")}`}</Text>
      <Text>{`failure:${String(current.failure)}`}</Text>
      <Notice
        visible={current.last !== null}
        onDismiss={current.forget}
        action={{ label: "undo", onPress: current.undo }}
      >
        {`removed:${current.undoable.length}`}
      </Notice>
    </View>
  );
}

let client: QueryClient;

async function renderHarness() {
  // No garbage-collection timer: a finished mutation would otherwise hold the
  // test process open for its five-minute `gcTime`.
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaperProvider theme={MD3LightTheme}>
        <Harness />
      </PaperProvider>
    </QueryClientProvider>,
  );
}

/** Lets the promise chain settle, then TanStack's batched (setTimeout 0) notify. */
async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function pressUndo(view: Awaited<ReturnType<typeof renderHarness>>) {
  await fireEvent.press(view.getByText("undo"));
  await act(flush);
}

async function removeAll(ids: string[]) {
  for (const id of ids) {
    await act(async () => {
      removal.remove(transaction(id));
      await flush();
      mockDeletions.get(id)?.resolve();
      await flush();
    });
  }
}

beforeEach(() => {
  mockDeletions.clear();
  mockRestores.length = 0;
});

afterEach(() => client.clear());

it("restores the latest deletion and keeps the others undoable", async () => {
  const view = await renderHarness();
  await removeAll(["A", "B", "C"]);
  expect(view.getByText("stack:A,B,C")).toBeTruthy();

  // Paper calls `onDismiss` right after the action: that must not empty the
  // stack the user is in the middle of unwinding.
  await pressUndo(view);
  expect(mockRestores.map((restore) => restore.id)).toEqual(["C"]);
  expect(view.getByText("stack:A,B,C")).toBeTruthy();

  await act(async () => {
    mockRestores[0].pending.resolve();
    await flush();
  });
  expect(view.getByText("stack:A,B")).toBeTruthy();
  expect(view.getByText("removed:2")).toBeTruthy();

  await pressUndo(view);
  expect(mockRestores.map((restore) => restore.id)).toEqual(["C", "B"]);
});

it("keeps a failed restore on the stack so it can be asked for again", async () => {
  const view = await renderHarness();
  await removeAll(["A", "B"]);

  await pressUndo(view);
  await act(async () => {
    mockRestores[0].pending.reject(new Error("500"));
    await flush();
  });

  expect(view.getByText("failure:undo")).toBeTruthy();
  expect(view.getByText("stack:A,B")).toBeTruthy();

  await pressUndo(view);
  expect(mockRestores.map((restore) => restore.id)).toEqual(["B", "B"]);
});

it("sends one restore however fast the action is tapped", async () => {
  const view = await renderHarness();
  await removeAll(["A"]);

  await act(async () => {
    removal.undo();
    removal.undo();
    await flush();
  });

  expect(mockRestores.map((restore) => restore.id)).toEqual(["A"]);
  expect(view.getByText("stack:A")).toBeTruthy();
});

it("drops the stack when the notice times out on its own", async () => {
  const view = await renderHarness();
  await removeAll(["A", "B"]);

  await act(async () => removal.forget());

  expect(view.getByText("stack:")).toBeTruthy();
  expect(view.getByText("removed:0")).toBeTruthy();
});

it("lets an undo pressed without a dismissal leave the next timeout alone", async () => {
  const view = await renderHarness();
  await removeAll(["A", "B"]);

  await act(async () => {
    removal.undo();
    await flush();
  });
  await act(async () => removal.forget());

  // B's restore is still in flight, so it stays; A goes with the notice.
  expect(view.getByText("stack:B")).toBeTruthy();
  await act(async () => {
    mockRestores[0].pending.reject(new Error("500"));
    await flush();
  });
  expect(view.getByText("stack:B")).toBeTruthy();
  expect(view.getByText("failure:undo")).toBeTruthy();
});

it("records every deletion even when the next one is sent before it answers", async () => {
  const view = await renderHarness();

  await act(async () => {
    removal.remove(transaction("A"));
    await flush();
    removal.remove(transaction("B"));
    await flush();
  });
  await act(async () => {
    mockDeletions.get("A")?.resolve();
    mockDeletions.get("B")?.resolve();
    await flush();
  });

  expect(view.getByText("stack:A,B")).toBeTruthy();
});

it("reports each failed deletion and calls back only for the ones that went", async () => {
  const view = await renderHarness();
  const onRemovedA = jest.fn();
  const onRemovedB = jest.fn();

  await act(async () => {
    removal.remove(transaction("A"), onRemovedA);
    await flush();
    removal.remove(transaction("B"), onRemovedB);
    await flush();
  });
  await act(async () => {
    mockDeletions.get("A")?.reject(new Error("500"));
    mockDeletions.get("B")?.resolve();
    await flush();
  });

  expect(view.getByText("stack:B")).toBeTruthy();
  expect(view.getByText("failure:delete")).toBeTruthy();
  expect(onRemovedA).not.toHaveBeenCalled();
  expect(onRemovedB).toHaveBeenCalledTimes(1);
});
