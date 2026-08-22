import { act, fireEvent, render } from "@testing-library/react-native";
import type { SavingsGoal, SavingsGoalDeletionImpact } from "pulpe-shared";

import { hapticSuccess } from "@/core/ui/haptics";

import { GoalDeletionSheet } from "./goal-deletion-sheet";

const mockImpact = {
  data: undefined as SavingsGoalDeletionImpact | undefined,
  isPending: false,
  isError: false,
  refetch: jest.fn(async () => undefined),
};
const mockRemove = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  isError: false,
};

jest.mock("../goals-queries", () => ({
  useDeleteSavingsGoal: () => mockRemove,
  useSavingsGoalDeletionImpact: () => mockImpact,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSuccess: jest.fn() }));
jest.mock("@/core/ui/theme", () => ({
  SPACING: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24 },
}));
jest.mock("@/core/ui/scheme-colors", () => ({
  useFinancialColors: () => ({ destructive: "red" }),
}));
jest.mock("@/core/ui/amount-format", () => ({
  formatCompactCurrency: (amount: number) => `compact:${amount}`,
  formatCurrency: (amount: number) => `amount:${amount}`,
}));
jest.mock("@/core/ui/date-format", () => ({
  formatMonthLabel: (month: number, year: number) => `${year}-${month}`,
}));
jest.mock("@/core/ui/card", () => {
  const { View } = jest.requireActual("react-native");
  const Card = ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
  Card.Content = View;
  return { Card };
});
jest.mock("@/core/ui/amount", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    Amount: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/field-error", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    FieldError: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
  };
});
jest.mock("@/core/ui/sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      isVisible,
      title,
      children,
      footer,
      onDismiss,
      isBusy,
    }: {
      isVisible: boolean;
      title: string;
      children: React.ReactNode;
      footer: React.ReactNode;
      onDismiss: () => void;
      isBusy: boolean;
    }) =>
      isVisible ? (
        <View>
          <Text>{title}</Text>
          <Text>{`busy:${isBusy}`}</Text>
          {children}
          {footer}
          <Pressable
            accessibilityLabel="dismiss-form"
            disabled={isBusy}
            onPress={onDismiss}
          />
        </View>
      ) : null,
  };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{children}</Text>
      </Pressable>
    ),
    Checkbox: {
      Item: ({
        label,
        status,
        onPress,
      }: {
        label: string;
        status: string;
        onPress: () => void;
      }) => (
        <Pressable onPress={onPress} accessibilityLabel={label}>
          <Text>{`${label}:${status}`}</Text>
        </Pressable>
      ),
    },
    Divider: () => <View />,
    Text,
    useTheme: () => ({ colors: { onSurfaceVariant: "gray" } }),
  };
});

const goal: SavingsGoal = {
  id: "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d",
  userId: "9f8e7d6c-5b4a-4392-8172-6d5e4f3a2b1c",
  name: "Voyage",
  startDate: null,
  targetAmount: 6000,
  targetDate: "2027-08-01",
  status: "ACTIVE",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};
const revision = {
  templateLines: [],
  budgetLines: [],
  transactions: [],
};
const emptyImpact: SavingsGoalDeletionImpact = {
  goalId: goal.id,
  summary: {
    templateLineCount: 0,
    templateLineTotal: 0,
    budgetCount: 0,
    budgetLineCount: 0,
    budgetLineTotal: 0,
    transactionCount: 0,
    transactionTotal: 0,
    withdrawalCount: 0,
    withdrawalTotal: 0,
  },
  templateLines: [],
  budgets: [],
  withdrawals: [],
  revision,
};

const baseProps = {
  isVisible: true,
  onDismiss: jest.fn(),
  goal,
  currency: "CHF" as const,
  onDeleted: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockImpact, {
    data: undefined,
    isPending: false,
    isError: false,
  });
  Object.assign(mockRemove, { isPending: false, isError: false });
});

it("renders loading and retries an impact failure without a phantom choice", async () => {
  mockImpact.isPending = true;
  const view = await render(<GoalDeletionSheet {...baseProps} />);
  expect(
    view.getByText("goals.deletion.impactLoadingAccessibility"),
  ).toBeTruthy();
  expect(view.queryByText("goals.deletion.confirm.goal_only")).toBeNull();

  Object.assign(mockImpact, { isPending: false, isError: true });
  await view.rerender(<GoalDeletionSheet {...baseProps} />);
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockImpact.refetch).toHaveBeenCalledTimes(1);
  expect(mockRemove.mutate).not.toHaveBeenCalled();
});

it("deletes only the goal with the exact impact revision", async () => {
  mockImpact.data = emptyImpact;
  const view = await render(<GoalDeletionSheet {...baseProps} />);
  expect(view.getByText("goals.deletion.empty")).toBeTruthy();
  await fireEvent.press(view.getByText("goals.deletion.confirm.goal_only"));

  expect(mockRemove.mutate).toHaveBeenCalledWith(
    {
      goalId: goal.id,
      command: { mode: "goal_only", revision },
    },
    expect.any(Object),
  );
  const callbacks = mockRemove.mutate.mock.calls[0][1] as {
    onSuccess: () => void;
  };
  await act(() => callbacks.onSuccess());
  expect(hapticSuccess).toHaveBeenCalledTimes(1);
  expect(baseProps.onDeleted).toHaveBeenCalledTimes(1);
});

it.each([
  [false, "goal_and_forecasts"],
  [true, "goal_forecasts_and_transactions"],
] as const)(
  "submits the visible forecast scope with transactions=%s",
  async (withTransactions, mode) => {
    mockImpact.data = {
      ...emptyImpact,
      summary: {
        ...emptyImpact.summary,
        budgetCount: 1,
        budgetLineCount: 1,
        budgetLineTotal: 120,
        transactionCount: 1,
        transactionTotal: 40,
      },
      budgets: [
        {
          budgetId: "budget-1",
          month: 8,
          year: 2026,
          lines: [
            {
              lineId: "line-1",
              name: "Voyage",
              amount: 120,
              recurrence: "fixed",
              checkedAt: null,
              updatedAt: "2026-08-01T00:00:00.000Z",
              transactions: [],
            },
          ],
        },
      ],
    } as SavingsGoalDeletionImpact;
    const view = await render(<GoalDeletionSheet {...baseProps} />);
    await fireEvent.press(view.getByLabelText("goals.deletion.forecasts"));
    if (withTransactions)
      await fireEvent.press(view.getByLabelText("goals.deletion.movements"));
    await fireEvent.press(view.getByText(`goals.deletion.confirm.${mode}`));

    expect(mockRemove.mutate).toHaveBeenCalledWith(
      { goalId: goal.id, command: { mode, revision } },
      expect.any(Object),
    );
  },
);

it("blocks a second confirmation and dismissal while deletion is pending", async () => {
  mockImpact.data = emptyImpact;
  const view = await render(<GoalDeletionSheet {...baseProps} />);
  await fireEvent.press(view.getByText("goals.deletion.confirm.goal_only"));
  mockRemove.isPending = true;
  await view.rerender(<GoalDeletionSheet {...baseProps} />);

  await fireEvent.press(view.getByText("goals.deletion.pending"));
  await fireEvent.press(view.getByLabelText("dismiss-form"));
  expect(mockRemove.mutate).toHaveBeenCalledTimes(1);
  expect(baseProps.onDismiss).not.toHaveBeenCalled();
});
