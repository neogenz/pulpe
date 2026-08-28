import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import CreateBudgetScreen from "@/app/(main)/budget/create";

const mockBudgets = {
  data: [] as { month: number; year: number }[],
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};
const mockTemplates = {
  data: [] as { id: string; name: string; isDefault: boolean }[],
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};
const mockSettings = {
  data: { payDayOfMonth: null },
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};
const mockCreate = { mutate: jest.fn(), isPending: false, isError: false };

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: jest.fn(),
}));
jest.mock("@/core/ui/date-format", () => ({
  formatMonthLabel: (month: number, year: number) => `${year}-${month}`,
  formatMonthName: (month: number, year: number) => `${year}-${month}`,
}));
jest.mock("@/core/ui/theme", () => ({
  RADIUS: { card: 12 },
  SPACING: { md: 16, sm: 8 },
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/placeholder-screen", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    PlaceholderScreen: ({
      title,
      action,
    }: {
      title: string;
      action: { label: string; onPress: () => void };
    }) => (
      <View>
        <Text>{title}</Text>
        <Pressable onPress={action.onPress}>
          <Text>{action.label}</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  let changeRadio: (value: string) => void = () => undefined;
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    Appbar: {
      BackAction: ({
        onPress,
        accessibilityLabel,
      }: {
        onPress: () => void;
        accessibilityLabel: string;
      }) => (
        <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
      ),
      Content: ({ title }: { title: string }) => <Text>{title}</Text>,
    },
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
    Divider: () => null,
    HelperText: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    RadioButton: {
      Group: function RadioGroup({
        children,
        onValueChange,
        value,
      }: {
        children: React.ReactNode;
        onValueChange: (value: string) => void;
        value: string;
      }) {
        changeRadio = onValueChange;
        return (
          <View>
            <Text>{`radio:${value}`}</Text>
            {children}
          </View>
        );
      },
      Item: function RadioItem({
        value,
        label,
      }: {
        value: string;
        label: string;
      }) {
        return (
          <Pressable onPress={() => changeRadio(value)}>
            <Text>{label}</Text>
          </Pressable>
        );
      },
    },
    Text,
    useTheme: () => ({
      colors: {
        background: "white",
        onSurfaceVariant: "gray",
        surfaceVariant: "white",
        primary: "blue",
      },
    }),
  };
});
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
jest.mock("@/features/budgets/budget-queries", () => ({
  useBudgetList: () => mockBudgets,
}));
jest.mock("@/features/templates/template-queries", () => ({
  useTemplates: () => mockTemplates,
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => mockSettings,
}));
jest.mock("@/features/budgets/create-budget-mutation", () => ({
  useCreateBudget: () => mockCreate,
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockBudgets, { data: [], isPending: false, isError: false });
  Object.assign(mockTemplates, { data: [], isPending: false, isError: false });
  Object.assign(mockSettings, {
    data: { payDayOfMonth: null },
    isPending: false,
    isError: false,
  });
  Object.assign(mockCreate, { isPending: false, isError: false });
});

it("renders loading and retries every failed prerequisite", async () => {
  mockBudgets.isPending = true;
  const view = await render(<CreateBudgetScreen />);
  expect(view.getByText("common.loading")).toBeTruthy();

  Object.assign(mockBudgets, { isPending: false, isError: true });
  await view.rerender(<CreateBudgetScreen />);
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockBudgets.refetch).toHaveBeenCalledTimes(1);
  expect(mockTemplates.refetch).toHaveBeenCalledTimes(1);
  expect(mockSettings.refetch).toHaveBeenCalledTimes(1);
});

it("excludes an existing month, chooses the default template and opens the result", async () => {
  const now = new Date();
  mockBudgets.data = [{ month: now.getMonth() + 1, year: now.getFullYear() }];
  mockTemplates.data = [
    { id: "template-1", name: "Simple", isDefault: false },
    { id: "template-2", name: "Default", isDefault: true },
  ];
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const view = await render(<CreateBudgetScreen />);
  expect(view.getByText(`radio:template-2`)).toBeTruthy();
  expect(
    view.queryByText(`${now.getFullYear()}-${now.getMonth() + 1}`),
  ).toBeNull();
  await fireEvent.press(view.getByText("budgets.create.submit"));

  expect(mockCreate.mutate).toHaveBeenCalledWith(
    {
      month: next.getMonth() + 1,
      year: next.getFullYear(),
      description: `${next.getFullYear()}-${next.getMonth() + 1}`,
      templateId: "template-2",
    },
    expect.any(Object),
  );
  const callbacks = mockCreate.mutate.mock.calls[0][1] as {
    onSuccess: (budget: { id: string }) => void;
  };
  await act(() => callbacks.onSuccess({ id: "budget-created" }));
  expect(router.replace).toHaveBeenCalledWith("/budget/budget-created");
});

it("uses the selected period and template while keeping mutation errors recoverable", async () => {
  const now = new Date();
  mockTemplates.data = [
    { id: "template-1", name: "Simple", isDefault: false },
    { id: "template-2", name: "Default", isDefault: true },
  ];
  mockCreate.isError = true;
  const selected = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const view = await render(<CreateBudgetScreen />);
  await fireEvent.press(
    view.getByText(`${selected.getFullYear()}-${selected.getMonth() + 1}`),
  );
  await fireEvent.press(view.getByText("Simple"));
  expect(view.getByText("budgets.create.error")).toBeTruthy();
  expect(view.getByText("radio:template-1")).toBeTruthy();
  await fireEvent.press(view.getByText("budgets.create.submit"));
  expect(mockCreate.mutate).toHaveBeenCalledTimes(1);
});
