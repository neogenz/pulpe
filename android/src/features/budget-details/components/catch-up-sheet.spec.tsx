import type { BudgetLine, Transaction } from "pulpe-shared";
import { act, fireEvent, render } from "@testing-library/react-native";
import { PaperProvider } from "react-native-paper";

import { CatchUpSheet } from "./catch-up-sheet";

const mockUpdate = jest.fn();

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name === undefined ? key : `${key}:${String(options.name)}`,
  }),
}));
jest.mock("../budget-line-mutations", () => ({
  useUpdateBudgetLine: () => ({ mutateAsync: mockUpdate }),
}));

function line(id: string, amount: number, kind = "expense"): BudgetLine {
  return {
    id,
    budgetId: "b",
    templateLineId: null,
    savingsGoalId: null,
    assetId: null,
    name: id,
    amount,
    kind,
    recurrence: "one_off",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  } as BudgetLine;
}

const spent = {
  id: "t",
  budgetId: "b",
  budgetLineId: "courses",
  name: "t",
  amount: 364.2,
  kind: "expense",
  transactionDate: "2026-11-05T10:00:00.000Z",
  checkedAt: null,
  createdAt: "2026-11-05T10:00:00.000Z",
  updatedAt: "2026-11-05T10:00:00.000Z",
} as Transaction;

const ledger = {
  lines: [
    line("salaire", 3000, "income"),
    line("courses", 300),
    line("loisirs", 150),
  ],
  transactions: [spent],
  rollover: 0,
};

async function open() {
  const onDone = jest.fn();
  const view = await render(
    <PaperProvider>
      <CatchUpSheet
        onDismiss={jest.fn()}
        onDone={onDone}
        ledger={ledger}
        focusLineId={null}
        monthName="novembre"
        currency="CHF"
      />
    </PaperProvider>,
  );
  return { view, onDone };
}

const submitLabel = "budgets.catchUp.submit:loisirs";

beforeEach(() => mockUpdate.mockReset());

it("writes the lowered prévision first, then the raised one, and closes", async () => {
  mockUpdate.mockResolvedValue(undefined);
  const { view, onDone } = await open();

  await act(async () => {
    await fireEvent.press(view.getByText(submitLabel));
  });

  expect(mockUpdate.mock.calls.map(([call]) => call)).toEqual([
    { id: "loisirs", amount: 85.8, isManuallyAdjusted: true },
    { id: "courses", amount: 364.2, isManuallyAdjusted: true },
  ]);
  expect(onDone).toHaveBeenCalledTimes(1);
});

it("stops at the first failed write, says so, and a retry replays the sequence", async () => {
  mockUpdate
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(undefined);
  const { view, onDone } = await open();

  await act(async () => {
    await fireEvent.press(view.getByText(submitLabel));
  });

  expect(mockUpdate).toHaveBeenCalledTimes(2);
  expect(onDone).not.toHaveBeenCalled();
  expect(view.getByText("budgets.catchUp.error")).toBeTruthy();

  await act(async () => {
    await fireEvent.press(view.getByText(submitLabel));
  });

  // Absolute amounts: replaying the lowered prévision is harmless.
  expect(mockUpdate).toHaveBeenCalledTimes(4);
  expect(mockUpdate.mock.calls[3]?.[0]).toMatchObject({ id: "courses" });
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(view.queryByText("budgets.catchUp.error")).toBeNull();
});

it("exposes the chosen forecast as selected, then locked once a write failed", async () => {
  mockUpdate.mockRejectedValue(new Error("offline"));
  const { view } = await open();

  expect(
    view.getByRole("button", { selected: true, name: /loisirs/ }),
  ).toBeTruthy();

  await act(async () => {
    await fireEvent.press(view.getByText(submitLabel));
  });

  expect(view.getByText("loisirs")).toBeDisabled();
});
