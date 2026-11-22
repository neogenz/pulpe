import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReconciliationContext } from "pulpe-shared";
import { createElement, type ReactNode } from "react";

import { queryClient } from "@/core/query/query-client";

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

const CONTEXT: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: false,
  priorCorrection: 0,
  priorItems: [],
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

// The app's own client: the hooks under test reach it directly. Collected at
// once, a query or mutation left behind holds no five-minute timer that keeps
// Jest from exiting (a query removed while observed schedules one on unmount).
beforeAll(() => {
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: 0 },
    mutations: { ...defaults.mutations, gcTime: 0 },
  });
});

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

it("reads the context from scratch on each « Comparer »", async () => {
  mockBody = { success: true, data: CONTEXT };
  const hook = await renderHook(
    () => useReconciliationContext("budget-1", true),
    { wrapper },
  );
  await waitFor(() => expect(hook.result.current.data).toEqual(CONTEXT));

  forgetReconciliationContext("budget-1");
  expect(
    queryClient.getQueryData(reconciliationKeys.context("budget-1")),
  ).toBeUndefined();
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
