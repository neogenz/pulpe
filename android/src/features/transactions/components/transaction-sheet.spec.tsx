import type { Transaction } from "pulpe-shared";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import { TransactionSheet } from "./transaction-sheet";

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

jest.mock("../transaction-mutations", () => ({
  useCreateTransaction: () => mockCreate,
  useUpdateTransaction: () => mockUpdate,
}));
jest.mock("@/features/savings-goals/goals-queries", () => ({
  useSavingsGoalWithdrawalOptions: () => mockWithdrawalOptions,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/theme", () => ({
  SPACING: { lg: 24, md: 16, sm: 8, xxs: 2 },
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual("react-native");
  return {
    ActivityIndicator: () => <Text>loading</Text>,
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
      >
        <Text>{children}</Text>
      </Pressable>
    ),
    HelperText: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    SegmentedButtons: ({
      buttons,
      onValueChange,
    }: {
      buttons: { label: string; value: string }[];
      onValueChange: (value: string) => void;
    }) => (
      <View>
        {buttons.map((button) => (
          <Pressable
            key={button.value}
            onPress={() => onValueChange(button.value)}
          >
            <Text>{button.label}</Text>
          </Pressable>
        ))}
      </View>
    ),
    Switch: ({
      value,
      onValueChange,
      accessibilityLabel,
    }: {
      value: boolean;
      onValueChange: (value: boolean) => void;
      accessibilityLabel: string;
    }) => (
      <Pressable
        accessibilityLabel={accessibilityLabel}
        onPress={() => onValueChange(!value)}
      >
        <Text>{String(value)}</Text>
      </Pressable>
    ),
    Text,
    TextInput: ({
      label,
      value,
      onChangeText,
    }: {
      label: string;
      value: string;
      onChangeText: (value: string) => void;
    }) => (
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
      />
    ),
    useTheme: () => ({
      colors: { error: "red", onSurfaceVariant: "gray", surface: "white" },
    }),
  };
});
jest.mock("@/core/ui/amount-field", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    AmountField: ({ onChange }: { onChange: (amount: number) => void }) => (
      <View>
        {[120, 500].map((amount) => (
          <Pressable
            key={amount}
            accessibilityLabel={`set-amount-${amount}`}
            onPress={() => onChange(amount)}
          >
            <Text>{amount}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      title,
      children,
      footer,
      onDismiss,
      isBusy,
    }: {
      title: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      onDismiss: () => void;
      isBusy: boolean;
    }) => (
      <View>
        <Text>{title}</Text>
        <Text>{`busy:${isBusy}`}</Text>
        {children}
        {footer}
        <Pressable
          accessibilityLabel="dismiss-form"
          disabled={isBusy}
          onPress={onDismiss}
        >
          <Text>dismiss</Text>
        </Pressable>
      </View>
    ),
  };
});
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
    }: {
      children: React.ReactNode;
      onPress: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return function DateTimePickerMock({
    onChange,
  }: {
    onChange: (event: { type: string }, date: Date) => void;
  }) {
    return (
      <Pressable
        onPress={() =>
          onChange({ type: "set" }, new Date("2026-09-15T00:00:00Z"))
        }
      >
        <Text>select-date</Text>
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

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockCreate, { isPending: false, isError: false });
  Object.assign(mockUpdate, { isPending: false, isError: false });
});

async function fill(
  view: Awaited<ReturnType<typeof render>>,
  amount = 120,
  name = "Courses",
) {
  await fireEvent.press(view.getByLabelText(`set-amount-${amount}`));
  await fireEvent.changeText(
    view.getByLabelText("budgets.mutations.description"),
    name,
  );
}

it("creates the visible operation with its date and tags", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view);
  await fireEvent.press(view.getByLabelText("select-tag"));
  await fireEvent.press(view.getByLabelText("budgets.mutations.activity.date"));
  await fireEvent.press(view.getByText("select-date"));
  await fireEvent.press(view.getByText("budgets.mutations.add"));

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

it("requires a savings origin and refuses an excessive withdrawal", async () => {
  const view = await render(<TransactionSheet {...baseProps} />);
  await fireEvent.press(view.getByText("vocabulary.kind.income"));
  await fill(view, 500, "Retrait");
  await fireEvent.press(
    view.getByLabelText("budgets.mutations.activity.originAccessibility"),
  );
  expect(view.getByText("budgets.mutations.validation.goal")).toBeTruthy();
  await fireEvent.press(view.getByText(/Voyage/));
  expect(
    view.getByText("budgets.mutations.validation.exceedsGoal"),
  ).toBeTruthy();
  expect(mockCreate.mutate).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText("set-amount-120"));
  await fireEvent.press(view.getByText("budgets.mutations.add"));
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
  Object.assign(mockCreate, { isPending: true, isError: true });
  const view = await render(<TransactionSheet {...baseProps} />);
  await fill(view, 120, "Retry me");
  await fireEvent.press(view.getByLabelText("dismiss-form"));

  expect(view.getByText("busy:true")).toBeTruthy();
  expect(view.getByText("budgets.mutations.activity.error")).toBeTruthy();
  expect(view.getByLabelText("budgets.mutations.description").props.value).toBe(
    "Retry me",
  );
  expect(baseProps.onDismiss).not.toHaveBeenCalled();
  expect(mockCreate.mutate).not.toHaveBeenCalled();
});
