import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReconciliationContext } from "pulpe-shared";
import { createElement, type ReactNode } from "react";

import { queryClient } from "@/core/query/query-client";
import { toggleCheck } from "@/features/budgets/toggle-check-api";
import {
  useChecksSettled,
  useToggleCheck,
} from "@/features/budgets/toggle-check-mutation";

import { fetchReconciliationContext } from "./reconciliation-api";
import {
  forgetReconciliationContext,
  reconciliationKeys,
  useReconciliationContext,
  useWriteReconciliationState,
} from "./reconciliation-queries";

// The real API function runs, against a body the server could send: its
// schema is what is under test, not the HTTP layer.
let mockBody: unknown;
let mockPutBody: unknown;
// A read holds until this lets it land, with the body it was sent for.
let mockGetGate: Promise<void> = Promise.resolve();
jest.mock("@/core/api/api", () => ({
  api: {
    get: async (
      _path: string,
      schema: { parse: (value: unknown) => unknown },
    ) => {
      const body = mockBody;
      await mockGetGate;
      return schema.parse(body);
    },
    put: async (
      _path: string,
      _body: unknown,
      schema: { parse: (value: unknown) => unknown },
    ) => schema.parse(mockPutBody),
  },
}));
jest.mock("@/core/vault/vault-store", () => ({
  useVaultStore: (selector: (state: { status: string }) => unknown) =>
    selector({ status: "unlocked" }),
}));
jest.mock("@/features/budgets/budget-api", () => ({}));
jest.mock("@/features/savings-goals/goals-api", () => ({}));
jest.mock("@/features/budgets/toggle-check-api", () => ({
  toggleCheck: jest.fn(async () => undefined),
}));

const CONTEXT: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: false,
  priorCorrection: -40,
  priorItems: [
    {
      id: "5b0c3a6e-34a1-4b38-9d41-bf2a3cf8b9a1",
      source: "transaction",
      budgetId: "0f0d2f43-9b5e-4c1b-8d0c-0b7b1f3c2a11",
      name: "Pharmacie",
      amount: 40,
      kind: "expense",
      monthsAgo: 1,
      effect: -40,
    },
  ],
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

afterEach(() => {
  queryClient.clear();
  mockGetGate = Promise.resolve();
});

it("parses the server context and refuses one it cannot read", async () => {
  mockBody = { success: true, data: CONTEXT };
  await expect(fetchReconciliationContext("budget-1")).resolves.toEqual(
    CONTEXT,
  );

  mockBody = { success: true, data: { ...CONTEXT, priorItems: [{}] } };
  await expect(fetchReconciliationContext("budget-1")).rejects.toThrow();
});

it("reads the context again after a check, and from scratch on each « Comparer »", async () => {
  mockBody = { success: true, data: CONTEXT };
  const hook = await renderHook(
    () => ({
      context: useReconciliationContext("budget-1", true),
      toggle: useToggleCheck("budget-1"),
    }),
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.context.data).toEqual(CONTEXT),
  );

  // The check settles once the context is read again: the cache holds it then,
  // the hook's render follows on the next tick.
  mockBody = { success: true, data: { ...CONTEXT, priorCorrection: 0 } };
  await act(() =>
    hook.result.current.toggle.mutateAsync({
      source: "transaction",
      sourceId: "t-essence",
    }),
  );
  expect(
    queryClient.getQueryData<ReconciliationContext>(
      reconciliationKeys.context("budget-1"),
    )?.priorCorrection,
  ).toBe(0);

  forgetReconciliationContext("budget-1");
  expect(
    queryClient.getQueryData(reconciliationKeys.context("budget-1")),
  ).toBeUndefined();
  await hook.unmount();
});

it("waits for the re-read a check leaves to another one still out", async () => {
  mockBody = { success: true, data: CONTEXT };
  const hook = await renderHook(
    () => ({
      context: useReconciliationContext("budget-1", true),
      toggle: useToggleCheck("budget-1"),
      togglePrior: useToggleCheck(null),
      checksSettled: useChecksSettled(),
    }),
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.context.data).toEqual(CONTEXT),
  );
  let answerOther: () => void = () => undefined;
  jest
    .mocked(toggleCheck)
    .mockImplementationOnce(
      () => new Promise<void>((resolve) => (answerOther = resolve)),
    );
  mockBody = { success: true, data: { ...CONTEXT, priorCorrection: 0 } };
  const isLanded = () =>
    queryClient.getQueryData<ReconciliationContext>(
      reconciliationKeys.context("budget-1"),
    )?.priorCorrection === 0;

  let isSettled = false;
  await act(async () => {
    const other = hook.result.current.toggle.mutateAsync({
      source: "transaction",
      sourceId: "t-essence",
    });
    // Answered first, but its re-read waits for the other check.
    await hook.result.current.togglePrior.mutateAsync({
      source: "transaction",
      sourceId: "t-pharmacie",
    });
    void hook.result.current.checksSettled().then(() => {
      isSettled = true;
    });
    await Promise.resolve();
    expect(isLanded()).toBe(false);
    expect(isSettled).toBe(false);

    answerOther();
    await other;
  });

  await waitFor(() => expect(isSettled).toBe(true));
  expect(isLanded()).toBe(true);
  await hook.unmount();
});

it("keeps a confirmed write over a read that was already out", async () => {
  mockBody = { success: true, data: CONTEXT };
  const hook = await renderHook(
    () => ({
      context: useReconciliationContext("budget-1", true),
      write: useWriteReconciliationState("budget-1"),
    }),
    { wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.context.data).toEqual(CONTEXT),
  );

  // A foreground refresh goes out with the state from before the write.
  let landRead: () => void = () => undefined;
  mockGetGate = new Promise((resolve) => (landRead = resolve));
  await act(async () => {
    void hook.result.current.context.refetch();
  });
  mockPutBody = {
    success: true,
    data: { startingAmount: 3100, hasCompletedComparison: true },
  };
  await act(() =>
    hook.result.current.write.mutateAsync({
      startingAmount: 3100,
      completed: true,
    }),
  );
  await act(async () => landRead());

  expect(
    queryClient.getQueryData<ReconciliationContext>(
      reconciliationKeys.context("budget-1"),
    ),
  ).toMatchObject({ startingAmount: 3100, hasCompletedComparison: true });
  await hook.unmount();
});
