import type { BudgetLine } from "pulpe-shared";
import { act, fireEvent, render } from "@testing-library/react-native";

import { BudgetLineSheet } from "./budget-line-sheet";

const mockCreate = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};
const mockUpdate = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};
const mockSpread = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};

jest.mock("../budget-line-mutations", () => ({
  useCreateBudgetLine: () => mockCreate,
  useUpdateBudgetLine: () => mockUpdate,
}));
jest.mock("../spread/spread-queries", () => ({
  useCreateSpread: () => mockSpread,
}));
jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => "spread-1",
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({
  hapticSelection: jest.fn(),
  hapticSuccess: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../spread/components/spread-form-section", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    SpreadFormSection: ({
      onChangeMode,
    }: {
      onChangeMode?: (mode: string) => void;
    }) => (
      <View>
        <Pressable onPress={() => onChangeMode?.("perMonth")}>
          <Text>mode:perMonth</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("./savings-goal-links", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    SavingsGoalLinks: ({
      line,
      onNavigate,
    }: {
      line: { savingsGoalId: string | null };
      onNavigate: () => void;
    }) => (
      <Pressable
        accessibilityLabel={`open-goal-${line.savingsGoalId}`}
        onPress={onNavigate}
      >
        <Text>{line.savingsGoalId}</Text>
      </Pressable>
    ),
  };
});

const baseProps = {
  isVisible: true,
  onDismiss: jest.fn(),
  budgetId: "budget-1",
  anchor: { year: 2026, month: 8 },
  currency: "CHF" as const,
  onSaved: jest.fn(),
};
const AMOUNT_LABEL = "common.amountInCurrency";

beforeEach(() => {
  jest.clearAllMocks();
  for (const mutation of [mockCreate, mockUpdate, mockSpread])
    Object.assign(mutation, { isPending: false, isError: false });
});

async function fill(
  view: Awaited<ReturnType<typeof render>>,
  amount = 120,
  name = "Loyer",
) {
  await fireEvent.changeText(view.getByLabelText(AMOUNT_LABEL), String(amount));
  await fireEvent.changeText(
    view.getByLabelText("budgets.mutations.name"),
    name,
  );
}

it("creates a forecast and clears its amount for the next one", async () => {
  const view = await render(<BudgetLineSheet {...baseProps} />);
  await fill(view);
  await fireEvent.press(view.getByText("vocabulary.kind.saving"));
  await fireEvent.press(view.getByText("vocabulary.recurrence.one_off"));
  await fireEvent.press(view.getByText("budgets.mutations.add"));

  expect(mockCreate.mutate).toHaveBeenCalledWith(
    {
      budgetId: "budget-1",
      name: "Loyer",
      amount: 120,
      kind: "saving",
      recurrence: "one_off",
      isManuallyAdjusted: false,
    },
    expect.any(Object),
  );

  await act(() => mockCreate.mutate.mock.calls[0][1].onSuccess());
  expect(view.getByLabelText(AMOUNT_LABEL)).toHaveDisplayValue("");
  await fill(view, 15);
  await fireEvent.press(view.getByText("budgets.mutations.add"));
  expect(mockCreate.mutate).toHaveBeenLastCalledWith(
    expect.objectContaining({ amount: 15 }),
    expect.any(Object),
  );
});

it("updates an existing forecast without echoing untouched fields", async () => {
  const line = {
    id: "line-1",
    budgetId: "budget-1",
    name: "Old",
    amount: 100,
    kind: "expense",
    recurrence: "one_off",
    templateLineId: "template-line-1",
    savingsGoalId: "goal-1",
    assetId: "asset-1",
    sourceSavingsGoalId: null,
  } as BudgetLine;
  const view = await render(<BudgetLineSheet {...baseProps} line={line} />);
  await fill(view, 500, "New");
  await fireEvent.press(view.getByText("vocabulary.recurrence.fixed"));
  await fireEvent.press(view.getByText("budgets.mutations.save"));

  expect(mockUpdate.mutate).toHaveBeenCalledWith(
    {
      id: "line-1",
      name: "New",
      amount: 500,
      recurrence: "fixed",
      isManuallyAdjusted: true,
    },
    expect.any(Object),
  );
  expect(mockUpdate.mutate.mock.calls[0][0]).not.toHaveProperty(
    "savingsGoalId",
  );
  expect(mockUpdate.mutate.mock.calls[0][0]).not.toHaveProperty("assetId");
});

it("closes the sheet before opening its linked savings goal", async () => {
  const line = {
    id: "line-1",
    budgetId: "budget-1",
    name: "Voyage",
    amount: 100,
    kind: "saving",
    recurrence: "fixed",
    templateLineId: "template-line-1",
    savingsGoalId: "goal-1",
    sourceSavingsGoalId: null,
  } as BudgetLine;
  const view = await render(<BudgetLineSheet {...baseProps} line={line} />);

  await fireEvent.press(view.getByLabelText("open-goal-goal-1"));

  expect(baseProps.onDismiss).toHaveBeenCalledTimes(1);
  expect(mockUpdate.mutate).not.toHaveBeenCalled();
});

it("spreads a total or monthly amount over the selected window", async () => {
  const total = await render(<BudgetLineSheet {...baseProps} />);
  await fill(total);
  await fireEvent.press(total.getByText("budgets.detail.spread"));
  await fireEvent.press(total.getByText("budgets.mutations.spread"));
  expect(mockSpread.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Loyer",
      mode: "total",
      totalAmount: 120,
      spreadGroupId: "spread-1",
      months: [
        { year: 2026, month: 8 },
        { year: 2026, month: 9 },
        { year: 2026, month: 10 },
      ],
    }),
    expect.any(Object),
  );

  const monthly = await render(<BudgetLineSheet {...baseProps} />);
  await fill(monthly);
  await fireEvent.press(monthly.getByText("budgets.detail.spread"));
  await fireEvent.press(monthly.getByText("mode:perMonth"));
  await fireEvent.press(monthly.getByText("budgets.mutations.spread"));
  expect(mockSpread.mutate).toHaveBeenLastCalledWith(
    expect.objectContaining({
      mode: "perMonth",
      perMonthAmount: 120,
    }),
    expect.any(Object),
  );
});

it("asks « Quand ? » once, with the amount captioned by what it covers", async () => {
  const view = await render(<BudgetLineSheet {...baseProps} />);

  expect(view.getByText("budgets.mutations.forecast.when")).toBeTruthy();
  expect(view.getByText("budgets.mutations.forecast.perMonth")).toBeTruthy();

  await fireEvent.press(view.getByText("vocabulary.recurrence.one_off"));
  expect(view.queryByText("budgets.mutations.forecast.perMonth")).toBeNull();

  await fireEvent.press(view.getByText("budgets.detail.spread"));
  expect(view.getByText("budgets.mutations.forecast.inTotal")).toBeTruthy();
  await fireEvent.press(view.getByText("mode:perMonth"));
  expect(view.getByText("budgets.mutations.forecast.perMonth")).toBeTruthy();
});

it("starts a closed month on « Ponctuel » and keeps « Mensuel » out of reach", async () => {
  const view = await render(
    <BudgetLineSheet {...baseProps} isEveryMonthDisabled />,
  );
  await fill(view);

  await fireEvent.press(view.getByText("vocabulary.recurrence.fixed"));
  await fireEvent.press(view.getByText("budgets.mutations.add"));
  expect(mockCreate.mutate).toHaveBeenCalledWith(
    expect.objectContaining({ recurrence: "one_off" }),
    expect.any(Object),
  );
});

it("offers no spread to an income", async () => {
  const view = await render(<BudgetLineSheet {...baseProps} />);
  await fireEvent.press(view.getByText("vocabulary.kind.income"));

  expect(view.queryByText("budgets.detail.spread")).toBeNull();
});

it("blocks dismissal while pending and keeps a rejected form editable", async () => {
  mockCreate.isPending = true;
  const view = await render(<BudgetLineSheet {...baseProps} />);
  await fill(view, 120, "Retry me");
  const close = view.getByRole("button", { name: "common.close" });
  expect(close).toBeDisabled();
  await fireEvent.press(close);
  expect(baseProps.onDismiss).not.toHaveBeenCalled();

  Object.assign(mockCreate, { isPending: false, isError: true });
  await view.rerender(<BudgetLineSheet {...baseProps} />);
  expect(view.getByText("budgets.mutations.forecast.error")).toBeOnTheScreen();
  expect(close).toBeEnabled();
  expect(view.getByLabelText("budgets.mutations.name")).toHaveDisplayValue(
    "Retry me",
  );
});
