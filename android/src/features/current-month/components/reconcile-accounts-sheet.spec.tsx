import { act, fireEvent, render } from "@testing-library/react-native";
import { getBudgetPeriodDates } from "pulpe-shared";

import { captureEvent } from "@/core/observability/analytics";

import type { RealizedMetrics } from "../current-month-view-model";
import {
  type ReconcileMonth,
  ReconcileAccountsSheet,
} from "./reconcile-accounts-sheet";

const mockCreate = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};

jest.mock("@/features/transactions/transaction-mutations", () => ({
  useCreateTransaction: () => mockCreate,
}));
jest.mock("@/core/observability/analytics", () => ({
  captureEvent: jest.fn(),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr-CH",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${Object.values(params).join("|")}`,
  }),
}));
jest.mock("@/core/ui/theme", () => ({
  RADIUS: { card: 18 },
  SPACING: { lg: 24, md: 16, sm: 8, xs: 4, xxs: 2 },
}));
jest.mock("@/core/ui/amount", () => {
  const { Text } = jest.requireActual("react-native");
  return { Amount: Text };
});
jest.mock("@/core/ui/field-error", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    FieldError: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/notice", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Notice: ({
      visible,
      children,
    }: {
      visible: boolean;
      children: React.ReactNode;
    }) =>
      visible ? <Text testID="reconcile-error-notice">{children}</Text> : null,
  };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual("react-native");
  return {
    Button: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) => (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    IconButton: ({
      onPress,
      accessibilityLabel,
      accessibilityState,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
      accessibilityState?: { selected?: boolean };
    }) => (
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
      />
    ),
    Text,
    TextInput: Object.assign(
      ({
        label,
        value,
        onChangeText,
        onBlur,
        onSubmitEditing,
      }: {
        label: string;
        value: string;
        onChangeText: (value: string) => void;
        onBlur?: () => void;
        onSubmitEditing?: () => void;
      }) => (
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onSubmitEditing={onSubmitEditing}
        />
      ),
      { Affix: () => null },
    ),
    useTheme: () => ({
      colors: { onSurfaceVariant: "gray", surfaceVariant: "beige" },
    }),
    Divider: () => <View />,
  };
});
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      title,
      subtitle,
      children,
      footer,
      onDismiss,
      onBack,
      isBusy,
      isVisible,
    }: {
      title: string;
      subtitle?: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      onDismiss: () => void;
      onBack?: () => void;
      isBusy: boolean;
      isVisible: boolean;
    }) =>
      isVisible ? (
        <View>
          <Text>{title}</Text>
          <Text>{subtitle}</Text>
          <Text>{`busy:${isBusy}`}</Text>
          {children}
          {footer}
          <Pressable
            accessibilityLabel="scrim"
            onPress={isBusy ? undefined : onDismiss}
          />
          <Pressable
            accessibilityLabel="android-back"
            onPress={isBusy ? undefined : (onBack ?? onDismiss)}
          />
        </View>
      ) : null,
  };
});

const REALIZED: RealizedMetrics = {
  realizedIncome: 5000,
  realizedExpenses: 3380.01,
  realizedSpending: 3080.01,
  realizedSavings: 300,
  realizedBalance: 1499.99,
  checkedItemsCount: 4,
  totalItemsCount: 6,
};
const REALIZED_LEVEL: RealizedMetrics = { ...REALIZED, realizedBalance: 1500 };

function renderSheet(realized: Partial<RealizedMetrics> = {}) {
  const month: ReconcileMonth = {
    realized: { ...REALIZED, ...realized },
    rollover: -120,
    period: getBudgetPeriodDates(6, 2025, 27),
  };
  const props = {
    isVisible: true,
    onDismiss: jest.fn(),
    onRecorded: jest.fn(),
    onViewItemsToCheck: jest.fn(),
    onRecordFailed: jest.fn(),
    budgetId: "budget-1",
    month,
    currency: "CHF" as const,
  };
  return { props, view: render(<ReconcileAccountsSheet {...props} />) };
}

async function reachVerdict(
  view: Awaited<ReturnType<typeof renderSheet>["view"]>,
  amount: string,
) {
  await fireEvent.changeText(view.getByLabelText(AMOUNT), amount);
  await fireEvent.press(view.getByText("home.reconcile.continue"));
  await fireEvent.press(view.getByText("home.reconcile.continue"));
}

const AMOUNT = "home.reconcile.accounts.firstAmount";

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockCreate, { isPending: false, isError: false });
});

it("walks back one step at a time from the Android back action, then leaves", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.continue"));
  expect(view.getByText("home.reconcile.realized.heading")).toBeTruthy();

  await fireEvent.press(view.getByLabelText("android-back"));
  expect(view.getByLabelText(AMOUNT).props.value).toBe("1500");
  expect(props.onDismiss).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText("android-back"));
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(mockCreate.mutate).not.toHaveBeenCalled();
});

it("dismisses from the scrim without changing step, and forgets what was typed", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.continue"));

  await fireEvent.press(view.getByLabelText("scrim"));

  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(view.getByLabelText(AMOUNT).props.value).toBe("");
  expect(mockCreate.mutate).not.toHaveBeenCalled();
});

it("adds and removes named accounts, totals them live and takes an overdraft", async () => {
  const { view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1000");
  await fireEvent.press(view.getByText("home.reconcile.accounts.addAccount"));
  await fireEvent.changeText(
    view.getByLabelText("home.reconcile.accounts.accountName"),
    "Épargne",
  );
  await fireEvent.changeText(
    view.getByLabelText("home.reconcile.accounts.amount"),
    "300",
  );
  expect(view.getByTestId("reconcile-total")).toHaveTextContent(/1’300\.00/);

  const signs = view.getAllByLabelText("home.reconcile.accounts.negative");
  await fireEvent.press(signs[0]);
  expect(view.getByLabelText(AMOUNT).props.value).toBe("-1000");
  expect(
    view.getAllByLabelText("home.reconcile.accounts.negative")[0].props
      .accessibilityState,
  ).toEqual(expect.objectContaining({ selected: true }));
  expect(view.getByTestId("reconcile-total")).toHaveTextContent(/-700\.00/);

  await fireEvent.press(
    view.getByLabelText("home.reconcile.accounts.removeNamed:Épargne"),
  );
  expect(view.queryByLabelText("home.reconcile.accounts.amount")).toBeNull();
  expect(view.getByTestId("reconcile-total")).toHaveTextContent(/-1’000\.00/);
});

it("refuses an unreadable amount even beside a valid one", async () => {
  const { view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1000");
  await fireEvent.press(view.getByText("home.reconcile.accounts.addAccount"));
  const second = view.getByLabelText("home.reconcile.accounts.amount");
  await fireEvent.changeText(second, "12abc");
  await fireEvent(second, "blur");

  expect(view.getByText("home.reconcile.accounts.invalidAmount")).toBeTruthy();
  await fireEvent.press(view.getByText("home.reconcile.continue"));
  expect(view.queryByText("home.reconcile.realized.heading")).toBeNull();
});

it("shows the realized balance, the period bounds and the way to what is left to check", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.continue"));

  expect(
    view.getByText("home.reconcile.realized.period:27 mai|26 juin"),
  ).toBeTruthy();
  expect(view.getByTestId("reconcile-realized-balance")).toHaveTextContent(
    /1’499\.99/,
  );
  expect(view.getByTestId("reconcile-rollover")).toHaveTextContent(/-120\.00/);

  await fireEvent.press(
    view.getByText("home.reconcile.realized.viewItemsToCheck"),
  );
  expect(props.onViewItemsToCheck).toHaveBeenCalledTimes(1);
});

it("records one checked adjustment with the edited label and reports completion once", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.continue"));
  await fireEvent.press(view.getByText("home.reconcile.continue"));

  expect(
    view.getByText("home.reconcile.verdict.moreTitle:0.01 CHF"),
  ).toBeTruthy();
  await fireEvent.changeText(
    view.getByLabelText("home.reconcile.verdict.label"),
    "Écart banque",
  );
  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));

  expect(mockCreate.mutate).toHaveBeenCalledTimes(1);
  const [payload, callbacks] = mockCreate.mutate.mock.calls[0] as [
    Record<string, unknown>,
    { onSuccess: () => void },
  ];
  expect(payload).toEqual({
    budgetId: "budget-1",
    name: "Écart banque",
    amount: 0.01,
    kind: "income",
    transactionDate: expect.any(String),
    checkedAt: expect.any(String),
  });

  await act(() => callbacks.onSuccess());

  expect(captureEvent).toHaveBeenCalledTimes(1);
  expect(captureEvent).toHaveBeenCalledWith(
    "account_reconciliation_completed",
    { adjustment_kind: "income" },
  );
  expect(props.onRecorded).toHaveBeenCalledTimes(1);
});

it("holds every exit while the write is pending and keeps the step after a failure", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 1600 });
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "1500");
  await fireEvent.press(view.getByText("home.reconcile.continue"));
  await fireEvent.press(view.getByText("home.reconcile.continue"));

  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));
  // A second tap landing before the pending state renders writes nothing.
  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));
  expect(mockCreate.mutate).toHaveBeenCalledTimes(1);
  const [, callbacks] = mockCreate.mutate.mock.calls[0] as [
    unknown,
    { onSettled: () => void },
  ];

  Object.assign(mockCreate, { isPending: true });
  await fireEvent.changeText(
    view.getByLabelText("home.reconcile.verdict.label"),
    "Ajustement",
  );
  expect(view.getByText("busy:true")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("android-back"));
  await fireEvent.press(view.getByLabelText("scrim"));
  await fireEvent.press(view.getByText("home.reconcile.back"));
  expect(props.onDismiss).not.toHaveBeenCalled();

  Object.assign(mockCreate, { isPending: false, isError: true });
  await act(() => callbacks.onSettled());
  await view.rerender(<ReconcileAccountsSheet {...props} />);

  expect(view.getByTestId("reconcile-error-notice")).toHaveTextContent(
    "budgets.mutations.activity.error",
  );
  expect(
    view.getByText("home.reconcile.verdict.lessTitle:100.00 CHF"),
  ).toBeTruthy();
  expect(view.getByLabelText("home.reconcile.verdict.label").props.value).toBe(
    "Ajustement",
  );

  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));
  expect(mockCreate.mutate).toHaveBeenCalledTimes(2);
  expect(mockCreate.mutate.mock.calls[1][0]).toEqual(
    expect.objectContaining({ kind: "expense", amount: 100 }),
  );
  expect(captureEvent).not.toHaveBeenCalled();
  // Still on screen with its own notice: nothing for the screen to say.
  expect(props.onRecordFailed).not.toHaveBeenCalled();
});

it("calls the accounts up to date at the exact cent and records nothing", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 0.1 + 0.2 });
  const view = await pending;
  await fireEvent.changeText(view.getByLabelText(AMOUNT), "0.30");
  await fireEvent.press(view.getByText("home.reconcile.continue"));
  await fireEvent.press(view.getByText("home.reconcile.continue"));

  expect(view.getByText("home.reconcile.verdict.upToDateTitle")).toBeTruthy();
  expect(view.queryByText("home.reconcile.verdict.record")).toBeNull();

  await fireEvent.press(view.getByText("home.reconcile.verdict.finish"));

  expect(mockCreate.mutate).not.toHaveBeenCalled();
  expect(captureEvent).toHaveBeenCalledTimes(1);
  expect(captureEvent).toHaveBeenCalledWith(
    "account_reconciliation_completed",
    { adjustment_kind: "none" },
  );
  expect(props.onDismiss).toHaveBeenCalledTimes(1);
});

it("holds Finish while the write is out, even once the month's balance turns level", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 1600 });
  const view = await pending;
  await reachVerdict(view, "1500");
  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));

  Object.assign(mockCreate, { isPending: true });
  await view.rerender(
    <ReconcileAccountsSheet
      {...props}
      month={{ ...props.month, realized: REALIZED_LEVEL }}
    />,
  );
  await fireEvent.press(view.getByText("home.reconcile.verdict.finish"));

  expect(captureEvent).not.toHaveBeenCalled();
  expect(props.onDismiss).not.toHaveBeenCalled();
  expect(mockCreate.reset).not.toHaveBeenCalled();
});

it("closes, writing nothing, once the screen no longer holds the month it opened on", async () => {
  const { props, view: pending } = renderSheet();
  const view = await pending;
  await reachVerdict(view, "1500");

  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  expect(mockCreate.mutate).not.toHaveBeenCalled();
  expect(captureEvent).not.toHaveBeenCalled();
  expect(view.getByLabelText(AMOUNT).props.value).toBe("");
});

it("lets a write already out settle on its own month, claiming nothing meanwhile, then closes", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 1600 });
  const view = await pending;
  await reachVerdict(view, "1500");
  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));
  const [payload, callbacks] = mockCreate.mutate.mock.calls[0] as [
    Record<string, unknown>,
    { onSettled: () => void },
  ];
  expect(payload).toEqual(
    expect.objectContaining({ budgetId: "budget-1", amount: 100 }),
  );

  Object.assign(mockCreate, { isPending: true });
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(props.onDismiss).not.toHaveBeenCalled();
  expect(view.queryByText("home.reconcile.verdict.upToDateTitle")).toBeNull();
  expect(view.queryByText("home.reconcile.verdict.finish")).toBeNull();

  Object.assign(mockCreate, { isPending: false, isError: true });
  await act(() => callbacks.onSettled());
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(props.onDismiss).toHaveBeenCalledTimes(1);
  // The sheet's own notice closes with it: the screen has to say it.
  expect(props.onRecordFailed).toHaveBeenCalledTimes(1);
  expect(mockCreate.mutate).toHaveBeenCalledTimes(1);
  expect(captureEvent).not.toHaveBeenCalled();
  expect(props.onRecorded).not.toHaveBeenCalled();
});

it("completes once when a write already out succeeds after the month went away", async () => {
  const { props, view: pending } = renderSheet({ realizedBalance: 1600 });
  const view = await pending;
  await reachVerdict(view, "1500");
  await fireEvent.press(view.getByText("home.reconcile.verdict.record"));
  const [, callbacks] = mockCreate.mutate.mock.calls[0] as [
    unknown,
    { onSuccess: () => void; onSettled: () => void },
  ];

  Object.assign(mockCreate, { isPending: true });
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);
  Object.assign(mockCreate, { isPending: false });
  await act(() => {
    callbacks.onSuccess();
    callbacks.onSettled();
  });
  await view.rerender(<ReconcileAccountsSheet {...props} month={null} />);

  expect(captureEvent).toHaveBeenCalledTimes(1);
  expect(captureEvent).toHaveBeenCalledWith(
    "account_reconciliation_completed",
    { adjustment_kind: "expense" },
  );
  expect(props.onRecorded).toHaveBeenCalledTimes(1);
  expect(props.onRecordFailed).not.toHaveBeenCalled();
});
