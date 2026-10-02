import type { Transaction } from "pulpe-shared";
import { createRef } from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler } from "react-native";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import {
  BudgetDetailOverlays,
  type BudgetDetailOverlaysHandle,
} from "./budget-detail-overlays";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/features/transactions/use-transaction-removal", () => ({
  useTransactionRemoval: () => ({
    last: null,
    undoable: [],
    failure: null,
    isPending: false,
    forget: jest.fn(),
    undo: jest.fn(),
    remove: jest.fn(),
    dismissFailure: jest.fn(),
  }),
}));
jest.mock("@/features/transactions/components/transaction-sheet", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    TransactionSheet: ({
      isVisible,
      transaction,
    }: {
      isVisible: boolean;
      transaction?: Transaction;
    }) =>
      isVisible ? (
        <Text>{transaction ? "edit-activity" : "add-activity"}</Text>
      ) : null,
  };
});
jest.mock("./budget-line-sheet", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    BudgetLineSheet: ({ isVisible }: { isVisible: boolean }) =>
      isVisible ? <Text>add-line</Text> : null,
  };
});
jest.mock("../savings-withdrawal/components/savings-withdrawal-sheet", () => ({
  SavingsWithdrawalSheet: () => null,
}));
jest.mock("@/features/current-month/components/realized-balance-sheet", () => ({
  RealizedBalanceSheet: () => null,
}));

async function renderOverlays() {
  const ref = createRef<BudgetDetailOverlaysHandle>();
  const view = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 800 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <PaperProvider>
        <BudgetDetailOverlays
          ref={ref}
          budgetId="budget-1"
          period={{ year: 2026, month: 10 }}
          currency="CHF"
          missingAmount={0}
          viewModel={null}
        />
      </PaperProvider>
    </SafeAreaProvider>,
  );
  return { ref, view };
}

/**
 * A budget is made of forecasts, and a loose operation is the other way to add
 * to it: two actions behind one FAB, the Android speed dial, rather than two
 * buttons written into the page.
 */
it("adds a forecast or a loose operation from its FAB menu", async () => {
  const { view } = await renderOverlays();

  await fireEvent.press(view.getByLabelText("budgets.mutations.add"));
  await fireEvent.press(
    view.getByTestId("budget-add-forecast", { includeHiddenElements: true }),
  );
  expect(view.getByText("add-line")).toBeTruthy();
});

it("offers the loose operation as the menu's second action", async () => {
  const { view } = await renderOverlays();

  await fireEvent.press(view.getByLabelText("budgets.mutations.add"));
  await fireEvent.press(
    view.getByTestId("budget-add-activity", { includeHiddenElements: true }),
  );
  await waitFor(() => expect(view.getByText("add-activity")).toBeTruthy());
});

it("folds the open speed dial on Back instead of leaving the budget", async () => {
  const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
  const addListener = jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, listener) => {
      handlers.push(listener);
      return { remove: () => handlers.splice(handlers.indexOf(listener), 1) };
    });
  try {
    const { view } = await renderOverlays();
    expect(handlers).toHaveLength(0);

    await fireEvent.press(view.getByLabelText("budgets.mutations.add"));
    expect(handlers).toHaveLength(1);

    let isHandled: boolean | null | undefined;
    await act(async () => {
      isHandled = handlers[0]!({} as never);
    });

    expect(isHandled).toBe(true);
    // Closed: the handler is gone, so the next Back leaves the screen.
    expect(handlers).toHaveLength(0);
  } finally {
    addListener.mockRestore();
  }
});
