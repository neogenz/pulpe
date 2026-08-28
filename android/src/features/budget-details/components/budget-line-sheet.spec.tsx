import type { BudgetLine } from "pulpe-shared";
import { fireEvent, render } from "@testing-library/react-native";

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
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/theme", () => ({
  SPACING: { md: 16, sm: 8, xxs: 2 },
}));
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
    useTheme: () => ({ colors: { onSurfaceVariant: "gray" } }),
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
  await fireEvent.press(view.getByLabelText(`set-amount-${amount}`));
  await fireEvent.changeText(
    view.getByLabelText("budgets.mutations.name"),
    name,
  );
}

it("creates a forecast from the visible fields", async () => {
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
  await fireEvent.press(
    total.getByLabelText("budgets.mutations.forecast.spreadTitle"),
  );
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
  await fireEvent.press(
    monthly.getByLabelText("budgets.mutations.forecast.spreadTitle"),
  );
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

it("blocks dismissal while pending and keeps a rejected form editable", async () => {
  Object.assign(mockCreate, { isPending: true, isError: true });
  const view = await render(<BudgetLineSheet {...baseProps} />);
  await fill(view, 120, "Retry me");
  await fireEvent.press(view.getByLabelText("dismiss-form"));

  expect(view.getByText("busy:true")).toBeTruthy();
  expect(view.getByText("budgets.mutations.forecast.error")).toBeTruthy();
  expect(view.getByLabelText("budgets.mutations.name").props.value).toBe(
    "Retry me",
  );
  expect(baseProps.onDismiss).not.toHaveBeenCalled();
  expect(mockCreate.mutate).not.toHaveBeenCalled();
});
