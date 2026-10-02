import {
  notifyManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react-native";
import {
  API_ERROR_CODES,
  type Transaction,
  type TransactionCreate,
} from "pulpe-shared";
import type React from "react";

import { ApiError, CLIENT_ERROR_CODES } from "@/core/api/api-error";

import { createTransaction, fetchTransaction } from "./transaction-api";
import { useCreateTransaction } from "./transaction-mutations";

jest.mock("@/core/vault/vault-store", () => ({ useVaultStore: () => true }));
jest.mock("@/features/budgets/budget-api", () => ({}));
jest.mock("@/features/savings-goals/goals-api", () => ({}));
jest.mock("./transaction-api", () => ({
  createTransaction: jest.fn(),
  fetchTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
  updateTransaction: jest.fn(),
}));

const mockedCreate = jest.mocked(createTransaction);
const mockedFetch = jest.mocked(fetchTransaction);

const PAYLOAD: TransactionCreate = {
  id: "6f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f",
  budgetId: "3f1a9c2e-5b6d-4f8a-9c1e-2d3b4a5c6d7e",
  name: "Courses",
  amount: 42,
  kind: "expense",
  transactionDate: "2026-10-02T09:00:00.000Z",
};

function persisted(payload: TransactionCreate): Transaction {
  return {
    ...payload,
    id: payload.id!,
    name: payload.name.trim(),
    budgetLineId: payload.budgetLineId ?? null,
    checkedAt: payload.checkedAt ?? null,
    sourceSavingsGoalId: payload.sourceSavingsGoalId ?? null,
    transactionDate: payload.transactionDate ?? "2026-10-02T09:00:00.000Z",
    createdAt: "2026-10-02T09:00:00.000Z",
    updatedAt: "2026-10-02T09:00:00.000Z",
  };
}

const alreadyWritten = new ApiError(
  "exists",
  API_ERROR_CODES.TRANSACTION_ALREADY_EXISTS,
  409,
  undefined,
);

beforeEach(() => {
  mockedCreate.mockReset();
  mockedFetch.mockReset();
  mockedFetch.mockRejectedValue(new Error("not found or offline"));
});

// Mutation notifications finish in the awaited act, instead of a later timer
// updating the observer after the test's interaction has already completed.
beforeAll(() => notifyManager.setScheduler(queueMicrotask));
afterAll(() =>
  notifyManager.setScheduler((callback) => setTimeout(callback, 0)),
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
  mockedFetch.mockResolvedValueOnce(persisted(PAYLOAD));
  const { hook, client } = await renderCreate();

  await act(() => hook.result.current.mutateAsync(PAYLOAD));

  expect(client.invalidateQueries).toHaveBeenCalled();
});

it("still fails a create that named no id", async () => {
  mockedCreate.mockRejectedValueOnce(alreadyWritten);
  const { hook } = await renderCreate();
  const { id: _id, ...withoutId } = PAYLOAD;

  await act(async () => {
    await expect(hook.result.current.mutateAsync(withoutId)).rejects.toBe(
      alreadyWritten,
    );
  });
});

it("does not claim a changed 42-to-500 retry was saved after a lost response", async () => {
  const lostResponse = new ApiError(
    "response lost",
    CLIENT_ERROR_CODES.NETWORK_ERROR,
    0,
    undefined,
  );
  // The server persists before the answer is lost. Its duplicate-id contract
  // is a 409, never an update of the row the first request already wrote.
  const rows = new Map<string, TransactionCreate>();
  mockedCreate.mockImplementation(async (payload) => {
    if (rows.has(payload.id!)) throw alreadyWritten;
    rows.set(payload.id!, { ...payload });
    throw lostResponse;
  });
  mockedFetch
    .mockRejectedValueOnce(lostResponse)
    .mockImplementation(async (id) => persisted(rows.get(id)!));
  const { hook, client } = await renderCreate();

  await act(async () => {
    await expect(hook.result.current.mutateAsync(PAYLOAD)).rejects.toBe(
      lostResponse,
    );
  });
  await act(async () => {
    await expect(
      hook.result.current.mutateAsync({ ...PAYLOAD, amount: 500 }),
    ).rejects.toBe(alreadyWritten);
  });

  expect(rows.size).toBe(1);
  expect(rows.get(PAYLOAD.id!)?.amount).toBe(42);
  expect(mockedCreate).toHaveBeenCalledTimes(2);
  expect(client.invalidateQueries).not.toHaveBeenCalled();

  await act(() => hook.result.current.mutateAsync(PAYLOAD));
  expect(mockedCreate).toHaveBeenCalledTimes(3);
  expect(rows.size).toBe(1);
  expect(client.invalidateQueries).toHaveBeenCalled();
});

it("refuses to confirm a different allocation or savings origin", async () => {
  mockedCreate.mockRejectedValue(alreadyWritten);
  const { hook } = await renderCreate();
  const withdrawal = {
    ...PAYLOAD,
    kind: "income" as const,
    sourceSavingsGoalId: "goal-1",
  };
  mockedFetch.mockResolvedValue(persisted(withdrawal));
  await act(async () => {
    await expect(
      hook.result.current.mutateAsync({
        ...withdrawal,
        sourceSavingsGoalId: "goal-2",
      }),
    ).rejects.toBe(alreadyWritten);
  });
  await act(async () => {
    await expect(
      hook.result.current.mutateAsync({
        ...withdrawal,
        sourceSavingsGoalId: undefined,
        budgetLineId: "line-1",
      }),
    ).rejects.toBe(alreadyWritten);
  });
  expect(mockedCreate).toHaveBeenCalledTimes(2);
});

it("lets a later independent operation carry different values", async () => {
  mockedCreate.mockResolvedValue({ ...PAYLOAD } as Transaction);
  const { hook } = await renderCreate();

  await act(() => hook.result.current.mutateAsync(PAYLOAD));
  // A new operation has its own identity, so it is free to carry new values.
  await act(() =>
    hook.result.current.mutateAsync({
      ...PAYLOAD,
      id: "0f1c2a7e-1d2b-4c3d-8e9f-0a1b2c3d4e5f",
      amount: 500,
    }),
  );

  expect(mockedCreate).toHaveBeenCalledTimes(2);
});

it("confirms a committed withdrawal even when retry fails before its duplicate check", async () => {
  const lostResponse = new Error("response lost");
  const insufficientBalance = new ApiError(
    "insufficient balance",
    API_ERROR_CODES.SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE,
    400,
    undefined,
  );
  const withdrawal: TransactionCreate = {
    ...PAYLOAD,
    kind: "income",
    sourceSavingsGoalId: "goal-1",
  };
  let balance = 50;
  let row: Transaction | undefined;
  mockedCreate.mockImplementation(async (payload) => {
    // The policy runs BEFORE insert/duplicate-id detection on the server.
    if (payload.amount > balance) throw insufficientBalance;
    row = persisted(payload);
    balance -= payload.amount;
    throw lostResponse;
  });
  mockedFetch
    .mockRejectedValueOnce(lostResponse)
    .mockImplementation(async () => row!);
  const { hook, client } = await renderCreate();

  await act(async () => {
    await expect(hook.result.current.mutateAsync(withdrawal)).rejects.toBe(
      lostResponse,
    );
  });
  expect(balance).toBe(8);
  await act(() => hook.result.current.mutateAsync(withdrawal));

  expect(balance).toBe(8);
  expect(row?.amount).toBe(42);
  expect(client.invalidateQueries).toHaveBeenCalled();
});

it("honors server-owned pointing and source for an allocated planned withdrawal", async () => {
  const allocation: TransactionCreate = {
    ...PAYLOAD,
    kind: "income",
    budgetLineId: "line-1",
    checkedAt: null,
  };
  mockedCreate.mockRejectedValue(alreadyWritten);
  mockedFetch.mockResolvedValue({
    ...persisted(allocation),
    transactionDate: "2026-10-02T09:00:00.000+00:00",
    sourceSavingsGoalId: "goal-1",
    checkedAt: "2026-10-02T09:00:01.000+00:00",
  });
  const { hook, client } = await renderCreate();

  await act(() => hook.result.current.mutateAsync(allocation));

  expect(client.invalidateQueries).toHaveBeenCalled();
});

it("does not mistake a deleted savings origin for a free income without origin", async () => {
  const income: TransactionCreate = { ...PAYLOAD, kind: "income" };
  mockedCreate.mockRejectedValue(alreadyWritten);
  mockedFetch.mockResolvedValue({
    ...persisted(income),
    sourceSavingsGoalId: null,
    sourceSavingsGoalName: "Deleted goal",
  });
  const { hook, client } = await renderCreate();

  await act(async () => {
    await expect(hook.result.current.mutateAsync(income)).rejects.toBe(
      alreadyWritten,
    );
  });

  expect(client.invalidateQueries).not.toHaveBeenCalled();
});

it.each([
  { budgetId: "other-budget" },
  { name: "Another entry" },
  { kind: "income" as const },
  { transactionDate: "2026-10-03T09:00:00.000Z" },
  { tagIds: ["other-tag"] },
  { checkedAt: "2026-10-02T09:00:00.000Z" },
])(
  "does not confirm a same-id row with a different submitted value: %o",
  async (change) => {
    mockedCreate.mockRejectedValue(alreadyWritten);
    mockedFetch.mockResolvedValue(persisted(PAYLOAD));
    const { hook, client } = await renderCreate();

    await act(async () => {
      await expect(
        hook.result.current.mutateAsync({ ...PAYLOAD, ...change }),
      ).rejects.toBe(alreadyWritten);
    });

    expect(client.invalidateQueries).not.toHaveBeenCalled();
  },
);
