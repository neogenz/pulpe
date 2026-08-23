import type { BudgetLine, Transaction } from "pulpe-shared";
import { createRef } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import {
  BudgetLineDetailOverlays,
  type BudgetLineDetailOverlaysHandle,
} from "./budget-line-detail-overlays";

const mockDeleteLine = jest.fn();
const mockDeletePair = jest.fn();
const mockPostpone = jest.fn();
const mockUndo = jest.fn();
const mockRemoveTransaction = jest.fn();
const mockRemoval = {
  last: null as Transaction | null,
  undoable: [] as Transaction[],
  failure: null as "delete" | "undo" | null,
  forget: jest.fn(),
  undo: mockUndo,
  remove: mockRemoveTransaction,
  dismissFailure: jest.fn(),
};

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("../budget-line-mutations", () => ({
  useDeleteBudgetLine: () => ({ mutate: mockDeleteLine, isPending: false }),
  usePostponeBudgetLine: () => ({ mutate: mockPostpone, isPending: false }),
}));
jest.mock("../savings-withdrawal/withdrawal-mutations", () => ({
  useDeleteSavingsWithdrawal: () => ({
    mutate: mockDeletePair,
    isPending: false,
  }),
}));
jest.mock("@/features/transactions/use-transaction-removal", () => ({
  useTransactionRemoval: () => mockRemoval,
}));
jest.mock("@/features/transactions/components/transaction-sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    TransactionSheet: ({
      isVisible,
      transaction,
      onDelete,
    }: {
      isVisible: boolean;
      transaction?: Transaction;
      onDelete?: () => void;
    }) =>
      isVisible ? (
        <View>
          <Text>{transaction ? "edit-activity" : "add-activity"}</Text>
          {onDelete && (
            <Pressable onPress={onDelete}>
              <Text>delete-activity</Text>
            </Pressable>
          )}
        </View>
      ) : null,
  };
});
jest.mock("./budget-line-sheet", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    BudgetLineSheet: ({ isVisible }: { isVisible: boolean }) =>
      isVisible ? <Text>edit-line</Text> : null,
  };
});
jest.mock("../spread/components/spread-existing-sheet", () => ({
  SpreadExistingSheet: () => null,
}));
jest.mock("../spread/components/spread-occurrences-sheet", () => ({
  SpreadOccurrencesSheet: () => null,
}));

const transaction = { id: "transaction-1", name: "Courses" } as Transaction;
const line = {
  id: "line-1",
  name: "Courses",
  amount: 200,
  kind: "expense",
  recurrence: "one_off",
  updatedAt: "2026-08-01T00:00:00Z",
  spreadGroupId: null,
  savingsWithdrawalGroupId: null,
} as BudgetLine;

async function renderOverlays(overrides: Partial<BudgetLine> = {}) {
  const ref = createRef<BudgetLineDetailOverlaysHandle>();
  const onLeave = jest.fn();
  const view = await render(
    <PaperProvider>
      <BudgetLineDetailOverlays
        ref={ref}
        budgetId="budget-1"
        period={{ year: 2026, month: 8 }}
        currency="CHF"
        payDayOfMonth={null}
        line={{ ...line, ...overrides }}
        transactions={[transaction]}
        onLeave={onLeave}
      />
    </PaperProvider>,
  );
  return { ref, onLeave, view };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRemoval.last = null;
  mockRemoval.undoable = [];
  mockRemoval.failure = null;
});

it("owns add, edit, activity removal and undo transitions", async () => {
  mockRemoval.last = transaction;
  mockRemoval.undoable = [transaction];
  const { ref, view } = await renderOverlays();

  await act(() => ref.current?.editLine());
  await act(() => ref.current?.addTransaction());
  await act(() => ref.current?.editTransaction(transaction));

  expect(view.getByText("edit-line")).toBeTruthy();
  expect(view.getByText("add-activity")).toBeTruthy();
  expect(view.getByText("edit-activity")).toBeTruthy();
  await fireEvent.press(view.getByText("delete-activity"));
  await fireEvent.press(view.getByText("budgets.mutations.undo"));
  expect(mockRemoveTransaction).toHaveBeenCalledWith(
    transaction,
    expect.any(Function),
  );
  expect(mockUndo).toHaveBeenCalledTimes(1);
});

it("surfaces a failed simple deletion", async () => {
  const { ref, view } = await renderOverlays();
  await act(() => ref.current?.confirmDelete());
  await fireEvent.press(view.getByText("budgets.mutations.delete"));

  const callbacks = mockDeleteLine.mock.calls[0][1] as { onError: () => void };
  await act(() => callbacks.onError());

  expect(mockDeleteLine).toHaveBeenCalledWith("line-1", expect.any(Object));
  expect(
    view.getByText("budgets.actions.line.failure.deleteLine"),
  ).toBeTruthy();
});

it("surfaces a failed postpone without leaving the detail", async () => {
  const { ref, view } = await renderOverlays();
  await act(() => ref.current?.postpone());
  const callbacks = mockPostpone.mock.calls[0][1] as { onError: () => void };
  await act(() => callbacks.onError());

  expect(mockPostpone).toHaveBeenCalledWith("line-1", expect.any(Object));
  expect(view.getByText("budgets.actions.line.failure.postpone")).toBeTruthy();
});

it("keeps both scopes of a linked savings deletion explicit", async () => {
  const { ref, view } = await renderOverlays({
    savingsWithdrawalGroupId: "withdrawal-1",
  });
  await act(() => ref.current?.confirmDelete());
  await fireEvent.press(view.getByText("budgets.actions.line.keepIncome"));
  expect(mockDeletePair.mock.calls[0][0]).toEqual({
    groupId: "withdrawal-1",
    scope: "repayment",
  });

  const callbacks = mockDeletePair.mock.calls[0][1] as { onError: () => void };
  await act(() => callbacks.onError());
  expect(
    view.getByText("budgets.actions.line.failure.deletePair"),
  ).toBeTruthy();

  await act(() => ref.current?.confirmDelete());
  await fireEvent.press(view.getByText("budgets.actions.line.cancelPair"));
  expect(mockDeletePair.mock.calls[1][0]).toEqual({
    groupId: "withdrawal-1",
    scope: "pair",
  });
});
