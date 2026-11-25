import type { Transaction } from "pulpe-shared";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import {
  COMPTE_COURANT,
  contractAssets,
  LEASING,
  REVOLUT,
} from "@/core/testing/net-worth-accounts";

import { TransactionSheet } from "./transaction-sheet";

let mockAccounts: {
  isFlagOn: boolean;
  assets: ReturnType<typeof contractAssets>;
} = { isFlagOn: false, assets: contractAssets() };
jest.mock("@/core/observability/feature-flags", () => ({
  useFeatureFlag: () => mockAccounts.isFlagOn,
}));
jest.mock("@/features/net-worth/net-worth-queries", () => ({
  useNetWorth: () => ({ data: { assets: mockAccounts.assets } }),
}));

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
const mockWithdrawalOptions = {
  data: [
    { goalId: "goal-1", name: "Voyage", availableAmount: 300, currency: "CHF" },
  ],
  isPending: false,
};

let mockUuidCount = 0;
jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => `operation-${(mockUuidCount += 1)}`,
}));
const mockRefreshAfterWrite = jest.fn();
const mockUnsaved = new WeakSet<object>();
jest.mock("../transaction-mutations", () => ({
  useCreateTransaction: () => mockCreate,
  useUpdateTransaction: () => mockUpdate,
  useRefreshAfterTransactionWrite: () => mockRefreshAfterWrite,
  isUnsavedCreate: (error: object) => mockUnsaved.has(error),
}));
let mockSettings: {
  data: { showCurrencySelector?: boolean; defaultAccountId?: string | null };
} = { data: {} };
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => mockSettings,
}));
let mockRate: { data?: unknown; isError: boolean } = {
  data: undefined,
  isError: false,
};
jest.mock("@/features/account/currency-queries", () => ({
  useCurrencyRate: () => mockRate,
}));
jest.mock("./movement-postpone-action", () => ({
  MovementPostponeAction: () => null,
}));
jest.mock("../first-movement-tracker", () => ({
  loadFirstMovementState: jest.fn(),
}));
jest.mock("@/features/savings-goals/goals-queries", () => ({
  useSavingsGoalWithdrawalOptions: () => mockWithdrawalOptions,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({
  hapticSelection: jest.fn(),
  hapticSuccess: jest.fn(),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: () => undefined,
  areAmountsHidden: () => false,
}));
jest.mock("@/core/ui/ripple", () => ({ useRipple: () => ({}) }));
let mockDetails: { data: unknown } = { data: undefined };
jest.mock("@/features/budgets/budget-queries", () => ({
  useBudgetDetails: () => mockDetails,
}));
jest.mock("@/features/tags/tag-picker", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    TagPicker: ({ onChange }: { onChange: (ids: string[]) => void }) => (
      <Pressable
        accessibilityLabel="select-tag"
        onPress={() => onChange(["tag-1"])}
      >
        <Text>tag</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/core/ui/fading-rail", () => ({
  FadingRail: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/filter-chip", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    FilterChip: ({
      children,
      onPress,
      disabled,
      selected,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
      selected?: boolean;
      testID?: string;
    }) => (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ selected: selected === true }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function DateTimePickerMock({
    onChange,
    minimumDate,
    maximumDate,
  }: {
    onChange: (event: { type: string }, date: Date) => void;
    minimumDate?: Date;
    maximumDate?: Date;
  }) {
    return (
      <Pressable
        onPress={() =>
          onChange({ type: "set" }, new Date("2026-09-15T00:00:00Z"))
        }
      >
        <Text>select-date</Text>
        <Text>{`bounds:${minimumDate?.getDate() ?? "-"}-${maximumDate?.getDate() ?? "-"}`}</Text>
      </Pressable>
    );
  };
});

const baseProps = {
  isVisible: true,
  onDismiss: jest.fn(),
  budgetId: "budget-1",
  currency: "CHF" as const,
  onSaved: jest.fn(),
};
const AMOUNT_LABEL = "common.amountInCurrency";

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockCreate, { isPending: false, isError: false });
  Object.assign(mockUpdate, { isPending: false, isError: false });
  mockDetails = { data: undefined };
  mockSettings = { data: {} };
  mockAccounts = { isFlagOn: false, assets: contractAssets() };
  mockRate = { data: undefined, isError: false };
  mockWithdrawalOptions.data = [
    { goalId: "goal-1", name: "Voyage", availableAmount: 300, currency: "CHF" },
  ];
});

async function fill(
  view: Awaited<ReturnType<typeof render>>,
  amount: string | number = 120,
  name = "Courses",
) {
  await fireEvent.changeText(view.getByLabelText(AMOUNT_LABEL), String(amount));
  await fireEvent.changeText(
    view.getByLabelText("budgets.mutations.description"),
    name,
  );
}

it("creates the visible operation with its date and tags", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view);
  await fireEvent.press(view.getByLabelText("select-tag"));
  await fireEvent.press(
    view.getByLabelText(/^budgets\.mutations\.activity\.date, /),
  );
  await fireEvent.press(view.getByText("select-date"));
  // TalkBack hears the chosen day, not just « Date ».
  expect(
    view.getByLabelText(/^budgets\.mutations\.activity\.date, .*15/),
  ).toBeTruthy();
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  expect(mockCreate.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      budgetId: "budget-1",
      name: "Courses",
      amount: 120,
      kind: "expense",
      tagIds: ["tag-1"],
      transactionDate: expect.any(String),
    }),
    expect.any(Object),
  );
  const { transactionDate } = mockCreate.mutate.mock.calls[0][0] as {
    transactionDate: string;
  };
  const chosenDate = new Date(transactionDate);
  expect([
    chosenDate.getFullYear(),
    chosenDate.getMonth(),
    chosenDate.getDate(),
  ]).toEqual([2026, 8, 15]);
  const callbacks = mockCreate.mutate.mock.calls[0][1] as {
    onSuccess: () => void;
  };
  await act(() => callbacks.onSuccess());
  await waitFor(() => expect(baseProps.onSaved).toHaveBeenCalledTimes(1));
});

it("replays the same id on a retry, and a new one for the next operation", async () => {
  // A request whose answer is lost on the way back is retried by the user;
  // the same id lets the server tell it from a second operation.
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view);
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  const ids = mockCreate.mutate.mock.calls.map(
    ([payload]) => (payload as { id: string }).id,
  );
  expect(ids[0]).toEqual(expect.any(String));
  expect(ids[1]).toBe(ids[0]);
  expect(mockCreate.mutate.mock.calls[1][0]).toEqual(
    mockCreate.mutate.mock.calls[0][0],
  );

  const callbacks = mockCreate.mutate.mock.calls[1][1] as {
    onSuccess: () => void;
  };
  await act(() => callbacks.onSuccess());
  expect(view.getByLabelText(AMOUNT_LABEL)).toHaveDisplayValue("");
  await fill(view, 15);
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  const next = mockCreate.mutate.mock.calls[2][0] as {
    id: string;
    amount: number;
  };
  expect(next.id).not.toBe(ids[0]);
  expect(next.amount).toBe(15);
});

it("locks every creation field at submission and explains the unchanged retry", async () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 2, 9), advanceTimers: true });
  try {
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view, 120, "First values");
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );
    const firstPayload = mockCreate.mutate.mock.calls[0][0];

    // The form fields stay locked while the operation is being written.
    expect(view.queryByLabelText("budgets.mutations.description")).toBeNull();
    expect(view.queryByLabelText(AMOUNT_LABEL)).toBeNull();
    expect(view.queryByLabelText("select-tag")).toBeNull();
    expect(
      view.queryByLabelText(/^budgets\.mutations\.activity\.date, /),
    ).toBeNull();
    expect(view.queryByText("vocabulary.kind.income")).toBeNull();
    expect(view.getByText("First values")).toBeTruthy();

    mockCreate.isError = true;
    jest.setSystemTime(new Date(2026, 9, 3, 14));
    await view.rerender(<TransactionSheet {...baseProps} />);
    expect(
      view.getByText("budgets.mutations.activity.retryUnchanged"),
    ).toBeTruthy();
    await fireEvent.press(view.getByText("common.retry"));

    // Even the time of day and pointing timestamp replay as originally sent.
    expect(mockCreate.mutate.mock.calls[1][0]).toEqual(firstPayload);
  } finally {
    jest.useRealTimers();
  }
});

it("refreshes the budget when an unconfirmed operation is abandoned", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view, 120, "Maybe saved");
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  mockCreate.isError = true;
  await view.rerender(<TransactionSheet {...baseProps} />);
  await fireEvent.press(view.getByRole("button", { name: "common.close" }));

  expect(mockRefreshAfterWrite).toHaveBeenCalledTimes(1);
  expect(baseProps.onDismiss).toHaveBeenCalled();
});

it("leaves the budget alone when a form that sent nothing is dismissed", async () => {
  mockCreate.isError = true;
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view, 120, "Never sent");
  await fireEvent.press(view.getByRole("button", { name: "common.close" }));

  expect(mockRefreshAfterWrite).not.toHaveBeenCalled();
  expect(baseProps.onDismiss).toHaveBeenCalled();
  expect(view.getByLabelText(AMOUNT_LABEL)).toHaveDisplayValue("");
});

/** Answers attempt `index` the way `useMutation` would, through its callbacks. */
async function failAttempt(index: number, error: Error) {
  const options = mockCreate.mutate.mock.calls[index][1] as {
    onError: (error: Error) => void;
  };
  await act(async () => options.onError(error));
  mockCreate.isError = true;
}

it("reopens the form, same id, when a refusal is known to have saved nothing", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view, 120, "Too much");
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));
  const first = mockCreate.mutate.mock.calls[0][0];

  const refusal = new Error("refused");
  mockUnsaved.add(refusal);
  await failAttempt(0, refusal);
  await view.rerender(<TransactionSheet {...baseProps} />);

  expect(
    view.queryByText("budgets.mutations.activity.retryUnchanged"),
  ).toBeNull();
  expect(view.getByText("budgets.mutations.activity.error")).toBeTruthy();
  expect(view.getByLabelText("budgets.mutations.description").props.value).toBe(
    "Too much",
  );

  await fireEvent.changeText(view.getByLabelText(AMOUNT_LABEL), "500");
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  expect(mockCreate.mutate.mock.calls[1][0]).toEqual(
    expect.objectContaining({ id: first.id, amount: 500, name: "Too much" }),
  );
});

it("keeps the submitted values once an attempt's answer was lost", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view, 120, "Maybe landed");
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  await failAttempt(0, new Error("network"));
  await view.rerender(<TransactionSheet {...baseProps} />);
  await fireEvent.press(view.getByText("common.retry"));

  const refusal = new Error("refused");
  mockUnsaved.add(refusal);
  await failAttempt(1, refusal);
  await view.rerender(<TransactionSheet {...baseProps} />);

  // The first request may still be written after this refusal: editing now
  // could leave the stored row and the screen disagreeing.
  expect(
    view.getByText("budgets.mutations.activity.retryUnchanged"),
  ).toBeTruthy();
  expect(view.queryByLabelText("budgets.mutations.description")).toBeNull();
});

it("retries submitted withdrawals even if refreshed options now show a smaller balance", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fireEvent.press(view.getByText("vocabulary.kind.income"));
  await fill(view, 120, "Withdrawal");
  await fireEvent(
    view.getByLabelText("budgets.mutations.activity.originAccessibility"),
    "change",
    { nativeEvent: { value: true } },
  );
  await fireEvent.press(view.getByText(/Voyage/));
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));
  const firstPayload = mockCreate.mutate.mock.calls[0][0];

  mockCreate.isError = true;
  mockWithdrawalOptions.data[0].availableAmount = 20;
  await view.rerender(<TransactionSheet {...baseProps} />);
  expect(
    view.queryByText("budgets.mutations.validation.exceedsGoal"),
  ).toBeNull();
  await fireEvent.press(view.getByText("common.retry"));

  expect(mockCreate.mutate.mock.calls[1][0]).toEqual(firstPayload);
});

it("dates a new operation inside its budget, and offers no other day", async () => {
  // September's budget, paid on the 25th, opened after it ended.
  const period = {
    startDate: new Date(2026, 7, 25),
    endDate: new Date(2026, 8, 24),
  };
  jest.useFakeTimers({ now: new Date(2026, 9, 2, 9, 0), advanceTimers: true });
  try {
    const view = await render(
      <TransactionSheet {...baseProps} period={period} />,
    );
    await fill(view);
    await fireEvent.press(
      view.getByLabelText(/^budgets\.mutations\.activity\.date, /),
    );
    expect(view.getByText("bounds:25-24")).toBeTruthy();
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );

    const { transactionDate } = mockCreate.mutate.mock.calls[0][0] as {
      transactionDate: string;
    };
    const day = new Date(transactionDate);
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([
      2026, 8, 24,
    ]);
  } finally {
    jest.useRealTimers();
  }
});

it("requires a savings origin and refuses an excessive withdrawal", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fireEvent.press(view.getByText("vocabulary.kind.income"));
  await fill(view, 500, "Retrait");
  await fireEvent(
    view.getByLabelText("budgets.mutations.activity.originAccessibility"),
    "change",
    { nativeEvent: { value: true } },
  );
  expect(view.getByText("budgets.mutations.validation.goal")).toBeTruthy();
  await fireEvent.press(view.getByText(/Voyage/));
  expect(
    view.getByText("budgets.mutations.validation.exceedsGoal"),
  ).toBeTruthy();
  expect(mockCreate.mutate).not.toHaveBeenCalled();

  await fireEvent.changeText(view.getByLabelText(AMOUNT_LABEL), "120");
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));
  expect(mockCreate.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "income",
      sourceSavingsGoalId: "goal-1",
      amount: 120,
    }),
    expect.any(Object),
  );
});

it("updates only the fields changed on an existing operation", async () => {
  const transaction = {
    id: "transaction-1",
    budgetId: "budget-1",
    budgetLineId: null,
    name: "Old",
    amount: 100,
    kind: "expense",
    transactionDate: "2026-08-10T08:00:00.000Z",
    checkedAt: null,
    tagIds: [],
    createdAt: "2026-08-10T08:00:00.000Z",
    updatedAt: "2026-08-10T08:00:00.000Z",
  } as Transaction;
  const view = await render(
    <TransactionSheet {...baseProps} transaction={transaction} />,
  );
  await fill(view, 500, "New");
  await fireEvent.press(view.getByText("vocabulary.kind.saving"));
  await fireEvent.press(view.getByLabelText("select-tag"));
  await fireEvent.press(view.getByText("budgets.mutations.save"));

  expect(mockUpdate.mutate).toHaveBeenCalledWith(
    {
      id: "transaction-1",
      changes: { name: "New", amount: 500, kind: "saving", tagIds: ["tag-1"] },
    },
    expect.any(Object),
  );
});

it("blocks dismissal while pending and preserves input on error", async () => {
  mockCreate.isPending = true;
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view, 120, "Retry me");
  const close = view.getByRole("button", { name: "common.close" });
  expect(close).toBeDisabled();
  await fireEvent.press(close);
  expect(baseProps.onDismiss).not.toHaveBeenCalled();

  Object.assign(mockCreate, { isPending: false, isError: true });
  await view.rerender(<TransactionSheet {...baseProps} />);
  expect(view.getByText("budgets.mutations.activity.error")).toBeOnTheScreen();
  expect(close).toBeEnabled();
  expect(
    view.getByLabelText("budgets.mutations.description"),
  ).toHaveDisplayValue("Retry me");
});

describe("« C'était prévu dans ton budget ? »", () => {
  beforeEach(() => {
    mockDetails = {
      data: {
        budget: { rollover: 0 },
        transactions: [],
        budgetLines: [
          {
            id: "line-1",
            name: "Loyer",
            kind: "expense",
            amount: 500,
            checkedAt: null,
          },
        ],
      },
    };
  });

  function createdPayload() {
    return mockCreate.mutate.mock.calls[0][0] as { budgetLineId?: string };
  }

  it("files the movement as an imprévu until a prévision is picked", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view);

    expect(
      view.getByTestId("movement-unplanned").props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(view.getByText("budgets.impact.over")).toBeTruthy();
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );

    expect(createdPayload().budgetLineId).toBeUndefined();
  });

  it("files it under the suggested prévision once picked, and covers the impact", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view);
    await fireEvent.press(view.getByText(/^Loyer · /));

    expect(view.getByText("budgets.impact.neutral")).toBeTruthy();
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );

    expect(createdPayload().budgetLineId).toBe("line-1");
  });

  it("opens the picker from « Autre » and files under the chosen prévision", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view);
    await fireEvent.press(view.getByTestId("movement-other-line"));
    expect(view.getByRole("radio", { checked: true })).toHaveProp(
      "testID",
      "movement-picker-unplanned",
    );
    await fireEvent.press(
      view.getByRole("radio", { name: /Loyer/, checked: false }),
    );
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );

    expect(createdPayload().budgetLineId).toBe("line-1");
  });

  it("goes back from the picker with the description and decimal entry intact", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view, "12,", "Café");
    expect(view.queryByRole("button", { name: "common.back" })).toBeNull();
    await fireEvent.press(view.getByTestId("movement-other-line"));
    expect(view.queryByLabelText(AMOUNT_LABEL)).toBeNull();

    await fireEvent.press(view.getByRole("button", { name: "common.back" }));
    expect(view.queryByRole("button", { name: "common.back" })).toBeNull();
    expect(view.getByLabelText(AMOUNT_LABEL)).toHaveDisplayValue("12,");
    expect(
      view.getByLabelText("budgets.mutations.description"),
    ).toHaveDisplayValue("Café");
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );
    expect(createdPayload()).toMatchObject({ name: "Café", amount: 12 });
  });

  it("locks the answer when editing", async () => {
    const transaction = {
      id: "tx-1",
      name: "Loyer",
      amount: 120,
      kind: "expense",
      budgetId: "budget-1",
      budgetLineId: "line-1",
      transactionDate: "2026-09-10T10:00:00.000Z",
      checkedAt: null,
      tagIds: [],
    } as unknown as Transaction;
    const view = await render(
      <TransactionSheet {...baseProps} transaction={transaction} />,
    );

    expect(
      view.getByTestId("movement-unplanned").props.accessibilityState,
    ).toMatchObject({ disabled: true });
    expect(view.queryByTestId("movement-other-line")).toBeNull();
  });
});

it("opens a new income already drawn from the chosen goal", async () => {
  const view = await render(
    <TransactionSheet {...baseProps} withdrawFromGoalId="goal-1" />,
  );

  await fill(view, 120, "Retrait");
  await fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  expect(mockCreate.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      kind: "income",
      sourceSavingsGoalId: "goal-1",
      amount: 120,
    }),
    expect.any(Object),
  );
});

describe("amount typed in the other currency", () => {
  beforeEach(() => {
    mockSettings = { data: { showCurrencySelector: true } };
  });

  it("books the converted amount and keeps the foreign leg", async () => {
    mockRate = {
      data: { base: "EUR", target: "CHF", rate: 0.9, date: "2026-11-14" },
      isError: false,
    };
    const view = await render(<TransactionSheet {...baseProps} />);
    await fireEvent.press(view.getByText(/EUR/));
    await fill(view, 500, "Hôtel");
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );

    expect(mockCreate.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 450,
        originalAmount: 500,
        originalCurrency: "EUR",
        targetCurrency: "CHF",
        exchangeRate: 0.9,
      }),
      expect.any(Object),
    );
  });

  it("waits for the rate instead of booking the typed figure as is", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    await fireEvent.press(view.getByText(/EUR/));
    await fill(view, 500, "Hôtel");
    await fireEvent.press(
      view.getByText("budgets.mutations.activity.addAmount"),
    );

    expect(mockCreate.mutate).not.toHaveBeenCalled();
  });

  it("offers no currency choice unless the setting is on", async () => {
    mockSettings = { data: {} };
    const view = await render(<TransactionSheet {...baseProps} />);

    expect(view.queryByText(/EUR/)).toBeNull();
  });
});

describe("editing a movement typed in another currency", () => {
  const booked = {
    id: "tx-1",
    budgetId: "budget-1",
    budgetLineId: null,
    name: "Hôtel",
    amount: 108,
    kind: "expense",
    transactionDate: "2026-09-02T09:00:00.000Z",
    tagIds: [],
    createdAt: "2026-09-02T09:00:00.000Z",
    updatedAt: "2026-09-02T09:00:00.000Z",
    checkedAt: null,
    originalAmount: 120,
    originalCurrency: "EUR",
    targetCurrency: "CHF",
    exchangeRate: 0.9,
  } as Transaction;

  beforeEach(() => {
    mockRate = {
      data: { base: "EUR", target: "CHF", rate: 0.95, date: "2026-11-14" },
      isError: false,
    };
  });

  it("opens on the typed figure and keeps the stored rate when only the name moves", async () => {
    const view = await render(
      <TransactionSheet {...baseProps} transaction={booked} />,
    );
    await fireEvent.changeText(
      view.getByLabelText("budgets.mutations.description"),
      "Hôtel Lyon",
    );
    await fireEvent.press(view.getByText("budgets.mutations.save"));

    expect(mockUpdate.mutate).toHaveBeenCalledWith(
      { id: "tx-1", changes: { name: "Hôtel Lyon" } },
      expect.any(Object),
    );
  });

  it("books the new figure at the fresh rate with its foreign leg", async () => {
    const view = await render(
      <TransactionSheet {...baseProps} transaction={booked} />,
    );
    await fireEvent.changeText(view.getByLabelText(AMOUNT_LABEL), "500");
    await fireEvent.press(view.getByText("budgets.mutations.save"));

    expect(mockUpdate.mutate).toHaveBeenCalledWith(
      {
        id: "tx-1",
        changes: {
          amount: 475,
          originalAmount: 500,
          originalCurrency: "EUR",
          targetCurrency: "CHF",
          exchangeRate: 0.95,
        },
      },
      expect.any(Object),
    );
  });
});

describe("« Compte » (PUL-378)", () => {
  const NONE = "netWorth.account.none";
  const free = {
    id: "transaction-1",
    budgetId: "budget-1",
    budgetLineId: null,
    accountId: COMPTE_COURANT,
    name: "Restaurant",
    amount: 80,
    kind: "expense",
    transactionDate: "2026-08-10T08:00:00.000Z",
    checkedAt: null,
    tagIds: [],
    createdAt: "2026-08-10T08:00:00.000Z",
    updatedAt: "2026-08-10T08:00:00.000Z",
  } as Transaction;

  beforeEach(() => {
    mockAccounts = { isFlagOn: true, assets: contractAssets() };
  });

  /** « Compte » is one field; its list opens in a sheet over the form. */
  const openAccounts = (view: Awaited<ReturnType<typeof render>>) =>
    fireEvent.press(view.getByTestId("account-field"));
  const created = () => mockCreate.mutate.mock.calls[0][0] as object;
  const add = (view: Awaited<ReturnType<typeof render>>) =>
    fireEvent.press(view.getByText("budgets.mutations.activity.addAmount"));

  it("CA1 lists « Aucun », then what I have and what I owe", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    await openAccounts(view);

    for (const name of [
      NONE,
      "Compte courant",
      "Revolut",
      "Livret",
      "Leasing",
      "Carte de crédit",
    ]) {
      expect(view.getByText(name)).toBeTruthy();
    }
    expect(view.getByText("netWorth.have")).toBeTruthy();
    expect(view.getByText("netWorth.owe")).toBeTruthy();
  });

  it("CA2 shows no field with the flag off, and sends no account", async () => {
    mockAccounts = { isFlagOn: false, assets: contractAssets() };
    const view = await render(<TransactionSheet {...baseProps} />);
    expect(view.queryByTestId("account-field")).toBeNull();
    await fill(view);
    await add(view);

    expect(created()).not.toHaveProperty("accountId");
  });

  it("CA2 shows no field without an active element", async () => {
    mockAccounts = { isFlagOn: true, assets: [] };
    const view = await render(<TransactionSheet {...baseProps} />);

    expect(view.queryByTestId("account-field")).toBeNull();
  });

  it("CA3 starts on « Aucun » without a default and sends null", async () => {
    const view = await render(<TransactionSheet {...baseProps} />);
    expect(view.getByDisplayValue(NONE)).toBeTruthy();
    await fill(view);
    await add(view);

    expect(created()).toMatchObject({ accountId: null });
  });

  it("CA29 prefills the default account, which stays changeable", async () => {
    mockSettings = { data: { defaultAccountId: COMPTE_COURANT } };
    const view = await render(<TransactionSheet {...baseProps} />);
    expect(view.getByDisplayValue("Compte courant")).toBeTruthy();
    await fill(view, 6000, "Salaire");
    await add(view);
    expect(created()).toMatchObject({ accountId: COMPTE_COURANT });

    mockCreate.mutate.mockClear();
    const other = await render(<TransactionSheet {...baseProps} />);
    await fill(other, 80, "Restaurant");
    await openAccounts(other);
    await fireEvent.press(other.getByText("Revolut"));
    await add(other);
    expect(created()).toMatchObject({ accountId: REVOLUT });
  });

  it("CA1 keeps « Compte » on an income drawn from a goal, like iOS", async () => {
    mockSettings = { data: { defaultAccountId: COMPTE_COURANT } };
    const view = await render(<TransactionSheet {...baseProps} />);
    await fireEvent.press(view.getByText("vocabulary.kind.income"));
    await fill(view, 120, "Retrait");
    await fireEvent(
      view.getByLabelText("budgets.mutations.activity.originAccessibility"),
      "change",
      { nativeEvent: { value: true } },
    );
    await fireEvent.press(view.getByText(/Voyage/));
    await openAccounts(view);
    await fireEvent.press(view.getByText("Revolut"));
    await add(view);

    expect(created()).toMatchObject({
      sourceSavingsGoalId: "goal-1",
      accountId: REVOLUT,
    });
  });

  it("CA29 lets me choose « Aucun » over the default", async () => {
    mockSettings = { data: { defaultAccountId: COMPTE_COURANT } };
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view);
    await openAccounts(view);
    await fireEvent.press(view.getByText(NONE));
    await add(view);

    expect(created()).toMatchObject({ accountId: null });
  });

  it("CA35 ignores a default that was archived", async () => {
    mockSettings = { data: { defaultAccountId: REVOLUT } };
    mockAccounts = {
      isFlagOn: true,
      assets: contractAssets([{}, { archivedAt: "2026-11-02T00:00:00.000Z" }]),
    };
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view);
    await add(view);

    expect(created()).toMatchObject({ accountId: null });
  });

  it("CA4 has no field, and sends no account, once filed under a prévision", async () => {
    mockDetails = {
      data: {
        budget: { rollover: 0 },
        transactions: [],
        budgetLines: [
          {
            id: "line-1",
            name: "Loyer",
            kind: "expense",
            amount: 500,
            checkedAt: null,
          },
        ],
      },
    };
    mockSettings = { data: { defaultAccountId: COMPTE_COURANT } };
    const view = await render(<TransactionSheet {...baseProps} />);
    await fill(view);
    await fireEvent.press(view.getByText(/^Loyer · /));

    expect(view.queryByTestId("account-field")).toBeNull();
    await add(view);
    expect(created()).toMatchObject({ budgetLineId: "line-1" });
    expect(created()).not.toHaveProperty("accountId");
  });

  it("CA4 has no field when editing a movement filed under a prévision", async () => {
    const view = await render(
      <TransactionSheet
        {...baseProps}
        transaction={{ ...free, budgetLineId: "line-1", accountId: null }}
      />,
    );

    expect(view.queryByTestId("account-field")).toBeNull();
  });

  it("CA26 keeps the account when an edit leaves the field alone", async () => {
    const view = await render(
      <TransactionSheet {...baseProps} transaction={free} />,
    );
    await fill(view, 90, "Restaurant");
    await fireEvent.press(view.getByText("budgets.mutations.save"));

    expect(mockUpdate.mutate).toHaveBeenCalledWith(
      { id: "transaction-1", changes: { amount: 90 } },
      expect.any(Object),
    );
  });

  it("sends the new account of an edit, and null for « Aucun »", async () => {
    const view = await render(
      <TransactionSheet {...baseProps} transaction={free} />,
    );
    await openAccounts(view);
    await fireEvent.press(view.getByText("Leasing"));
    await fireEvent.press(view.getByText("budgets.mutations.save"));
    expect(mockUpdate.mutate.mock.calls[0][0]).toEqual({
      id: "transaction-1",
      changes: { accountId: LEASING },
    });

    await openAccounts(view);
    await fireEvent.press(view.getByText(NONE));
    await fireEvent.press(view.getByText("budgets.mutations.save"));
    expect(mockUpdate.mutate.mock.calls[1][0]).toEqual({
      id: "transaction-1",
      changes: { accountId: null },
    });
  });
});
