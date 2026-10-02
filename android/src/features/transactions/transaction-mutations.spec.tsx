import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import { API_ERROR_CODES, type TransactionCreate } from "pulpe-shared";
import type React from "react";

import { ApiError } from "@/core/api/api-error";

import { createTransaction } from "./transaction-api";
import { useCreateTransaction } from "./transaction-mutations";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("@/features/budgets/budget-api", () => ({}));
jest.mock("@/features/savings-goals/goals-api", () => ({}));
jest.mock("./transaction-api", () => ({
  createTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
  updateTransaction: jest.fn(),
}));

const mockedCreate = jest.mocked(createTransaction);

const PAYLOAD: TransactionCreate = {
  id: "6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f",
  budgetId: "3f1a9c2e-5b6d-4f8a-9c1e-2d3b4a5c6d7e",
  name: "Courses",
  amount: 42,
  kind: "expense",
};

const alreadyWritten = new ApiError(
  "exists",
  API_ERROR_CODES.TRANSACTION_ALREADY_EXISTS,
  409,
  undefined,
);

async function renderCreate() {
  // No cache time: a mutation kept for the default five minutes holds a
  // timer that keeps Jest from exiting.
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false, gcTime: 0 } },
  });
  jest.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useCreateTransaction(), { wrapper });
  return { hook, client };
}

it("takes an id the server already holds as the retry's success", async () => {
  // The first attempt was written and its answer lost: the retry with the
  // same id is that same operation, not a failure to report.
  mockedCreate.mockRejectedValueOnce(alreadyWritten);
  const { hook, client } = await renderCreate();

  await act(() => hook.result.current.mutateAsync(PAYLOAD));

  expect(client.invalidateQueries).toHaveBeenCalled();
});

it("still fails a create that named no id", async () => {
  mockedCreate.mockRejectedValueOnce(alreadyWritten);
  const { hook } = await renderCreate();
  const { id: _id, ...withoutId } = PAYLOAD;

  await expect(
    act(() => hook.result.current.mutateAsync(withoutId)),
  ).rejects.toBe(alreadyWritten);
});
