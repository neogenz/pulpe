import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import {
  BudgetFormulas,
  type BudgetLine,
  type Transaction,
} from "pulpe-shared";
import type React from "react";

import type { BudgetDetails } from "@/features/budgets/budget-api";
import { budgetKeys } from "@/features/budgets/budget-queries";

import { createTransaction } from "./transaction-api";
import { useCreateTransaction } from "./transaction-mutations";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("@/features/budgets/budget-api", () => ({}));
jest.mock("@/features/savings-goals/goals-queries", () => ({
  goalKeys: { all: ["goals"] },
}));
jest.mock("./transaction-api", () => ({ createTransaction: jest.fn() }));

const STAMP = "2026-10-02T09:30:00.000Z";

const salary = {
  id: "salary",
  budgetId: "budget-1",
  kind: "income",
  amount: 4200,
  checkedAt: STAMP,
  recurrence: "fixed",
} as BudgetLine;

const adjustment = {
  id: "adjustment-1",
  budgetId: "budget-1",
  budgetLineId: null,
  name: "Ajustement",
  amount: 49.65,
  kind: "expense",
  transactionDate: STAMP,
  checkedAt: STAMP,
  createdAt: STAMP,
  updatedAt: STAMP,
} as Transaction;

const clients: QueryClient[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: Infinity },
      queries: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  jest.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  client.setQueryData<BudgetDetails>(budgetKeys.detail("budget-1"), {
    budget: { id: "budget-1", rollover: 0 },
    budgetLines: [salary],
    transactions: [],
  } as unknown as BudgetDetails);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

it("puts the created entry in its budget's cached details before any refetch", async () => {
  jest.mocked(createTransaction).mockResolvedValue(adjustment);
  const { client, wrapper } = setup();
  const hook = await renderHook(() => useCreateTransaction(), { wrapper });

  await act(() =>
    hook.result.current.mutateAsync({
      budgetId: "budget-1",
      name: "Ajustement",
      amount: 49.65,
      kind: "expense",
      transactionDate: STAMP,
      checkedAt: STAMP,
    }),
  );

  const cached = client.getQueryData<BudgetDetails>(
    budgetKeys.detail("budget-1"),
  );
  expect(cached?.transactions).toEqual([adjustment]);
  expect(
    BudgetFormulas.calculateRealizedBalance(
      cached?.budgetLines ?? [],
      cached?.transactions ?? [],
      0,
    ),
  ).toBeCloseTo(4150.35, 10);
  await hook.unmount();
});

it("never lists the same created entry twice", async () => {
  jest.mocked(createTransaction).mockResolvedValue(adjustment);
  const { client, wrapper } = setup();
  const hook = await renderHook(() => useCreateTransaction(), { wrapper });
  const payload = {
    budgetId: "budget-1",
    name: "Ajustement",
    amount: 49.65,
    kind: "expense" as const,
  };

  await act(() => hook.result.current.mutateAsync(payload));
  await act(() => hook.result.current.mutateAsync(payload));

  expect(
    client.getQueryData<BudgetDetails>(budgetKeys.detail("budget-1"))
      ?.transactions,
  ).toEqual([adjustment]);
  await hook.unmount();
});
