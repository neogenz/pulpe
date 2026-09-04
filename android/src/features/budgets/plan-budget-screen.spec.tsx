import { act, fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler } from "react-native";

import PlanBudgetsScreen from "@/app/(main)/budget/plan";

const mockTemplates = {
  data: [] as { id: string; name: string; isDefault: boolean }[],
  isPending: false,
  isError: false,
  refetch: jest.fn(async () => undefined),
};
const mockSettings = {
  data: { payDayOfMonth: 25 },
  isPending: false,
  isError: false,
  refetch: jest.fn(async () => undefined),
};
const mockGenerate = {
  mutate: jest.fn(),
  isPending: false,
  isError: false,
};
const mockBackHandlers: Parameters<typeof BackHandler.addEventListener>[1][] =
  [];
const removeBackHandler = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      key === "budgets.plan.periodCount"
        ? `periods:${String(options?.count)}`
        : key,
  }),
}));
jest.mock("@/core/ui/date-format", () => ({
  formatMonthName: (month: number, year: number) => `${year}-${month}`,
}));
jest.mock("@/core/ui/screen-app-bar", () => ({
  ScreenAppBar: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/core/ui/theme", () => ({
  RADIUS: { card: 12 },
  SPACING: { sm: 8, md: 16, lg: 24 },
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => mockSettings,
}));
jest.mock("@/features/templates/template-queries", () => ({
  useTemplates: () => mockTemplates,
}));
jest.mock("@/features/budgets/generate-budgets-mutation", () => ({
  useGenerateBudgets: () => mockGenerate,
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  let changeRadio: (value: string) => void = () => undefined;
  function Menu({
    visible,
    anchor,
    children,
  }: {
    visible: boolean;
    anchor: React.ReactNode;
    children: React.ReactNode;
  }) {
    return (
      <View>
        {anchor}
        {visible ? children : null}
      </View>
    );
  }
  function MenuItem({
    title,
    onPress,
  }: {
    title: string;
    onPress: () => void;
  }) {
    return (
      <Pressable accessibilityLabel={`option:${title}`} onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  }
  Menu.Item = MenuItem;
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    Appbar: {
      BackAction: ({
        onPress,
        disabled,
        accessibilityLabel,
      }: {
        onPress: () => void;
        disabled?: boolean;
        accessibilityLabel: string;
      }) => (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
        />
      ),
      Content: ({ title }: { title: string }) => <Text>{title}</Text>,
    },
    Button: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children: React.ReactNode;
      onPress: () => void;
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
    Divider: () => null,
    HelperText: ({ children }: { children: React.ReactNode }) => (
      <Text>{children}</Text>
    ),
    Menu,
    RadioButton: {
      Group: ({
        children,
        onValueChange,
        value,
      }: {
        children: React.ReactNode;
        onValueChange: (value: string) => void;
        value: string;
      }) => {
        changeRadio = onValueChange;
        return (
          <View>
            <Text>{`radio:${value}`}</Text>
            {children}
          </View>
        );
      },
      Item: ({ value, label }: { value: string; label: string }) => (
        <Pressable onPress={() => changeRadio(value)}>
          <Text>{label}</Text>
        </Pressable>
      ),
    },
    Text,
    useTheme: () => ({
      colors: {
        background: "white",
        onSurfaceVariant: "gray",
        primary: "purple",
        surfaceVariant: "white",
      },
    }),
  };
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 8, 1, 12));
  jest.clearAllMocks();
  Object.assign(mockTemplates, {
    data: [
      {
        id: "11111111-2222-3333-4444-555555555555",
        name: "Mois standard",
        isDefault: true,
      },
    ],
    isPending: false,
    isError: false,
  });
  Object.assign(mockSettings, {
    data: { payDayOfMonth: 25 },
    isPending: false,
    isError: false,
  });
  Object.assign(mockGenerate, { isPending: false, isError: false });
  mockBackHandlers.length = 0;
  removeBackHandler.mockClear();
  jest
    .spyOn(BackHandler, "addEventListener")
    .mockImplementation((_event, listener) => {
      mockBackHandlers.push(listener);
      return { remove: removeBackHandler };
    });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it("starts on twelve pay-day-aware periods and submits the shared payload", async () => {
  const view = await render(<PlanBudgetsScreen />);

  expect(view.getByText("2026-9")).toBeTruthy();
  expect(view.getByText("2027-8")).toBeTruthy();
  expect(view.getByText("periods:12")).toBeTruthy();
  expect(
    view.getByText("radio:11111111-2222-3333-4444-555555555555"),
  ).toBeTruthy();

  await fireEvent.press(view.getByLabelText("budgets.plan.submit"));
  expect(mockGenerate.mutate).toHaveBeenCalledWith(
    {
      templateId: "11111111-2222-3333-4444-555555555555",
      startMonth: 9,
      startYear: 2026,
      count: 12,
    },
    expect.any(Object),
  );

  const callbacks = mockGenerate.mutate.mock.calls[0]?.[1] as {
    onSuccess: (response: {
      data: { budgets: unknown[]; skippedMonths: unknown[] };
    }) => void;
  };
  await act(() =>
    callbacks.onSuccess({
      data: { budgets: [{}, {}], skippedMonths: [{}] },
    }),
  );
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/budgets",
    params: { createdCount: "2", skippedCount: "1" },
  });
});

it("uses the month and year menus and blocks a reversed range", async () => {
  const view = await render(<PlanBudgetsScreen />);

  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.yearAccessibility")[1],
  );
  await fireEvent.press(view.getByLabelText("option:2026"));
  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.monthAccessibility")[1],
  );
  await fireEvent.press(view.getByLabelText("option:2026-8"));

  expect(view.getByText("budgets.plan.rangeOrderError")).toBeTruthy();
  expect(view.queryByText("periods:0")).toBeNull();
  await fireEvent.press(view.getByLabelText("budgets.plan.submit"));
  expect(mockGenerate.mutate).not.toHaveBeenCalled();
});

it("keeps start years reversible and offers the full end horizon", async () => {
  const view = await render(<PlanBudgetsScreen />);

  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.yearAccessibility")[0],
  );
  await fireEvent.press(view.getByLabelText("option:2029"));

  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.yearAccessibility")[1],
  );
  expect(view.getByLabelText("option:2032")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("option:2032"));

  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.yearAccessibility")[0],
  );
  expect(view.getByLabelText("option:2026")).toBeTruthy();
});

it("blocks ranges over 36 periods and keeps mutation errors on screen", async () => {
  mockGenerate.isError = true;
  const view = await render(<PlanBudgetsScreen />);

  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.yearAccessibility")[1],
  );
  await fireEvent.press(view.getByLabelText("option:2029"));
  await fireEvent.press(
    view.getAllByLabelText("budgets.plan.monthAccessibility")[1],
  );
  await fireEvent.press(view.getByLabelText("option:2029-12"));

  expect(view.getByText("budgets.plan.rangeLimitError")).toBeTruthy();
  expect(view.getByText("budgets.plan.error")).toBeTruthy();
});

it("blocks visible and hardware back only while generation is pending", async () => {
  const view = await render(<PlanBudgetsScreen />);

  mockGenerate.isPending = true;
  await view.rerender(<PlanBudgetsScreen />);
  await fireEvent.press(view.getByLabelText("common.back"));

  expect(router.back).not.toHaveBeenCalled();
  expect(mockBackHandlers.at(-1)?.({} as never)).toBe(true);

  mockGenerate.isPending = false;
  mockGenerate.isError = true;
  await view.rerender(<PlanBudgetsScreen />);
  await fireEvent.press(view.getByLabelText("common.back"));

  expect(removeBackHandler).toHaveBeenCalledTimes(1);
  expect(router.back).toHaveBeenCalledTimes(1);
});

it("renders loading, retryable failure and missing-template states", async () => {
  mockSettings.isPending = true;
  const view = await render(<PlanBudgetsScreen />);
  expect(view.getByText("common.loading")).toBeTruthy();

  Object.assign(mockSettings, { isPending: false, isError: true });
  await view.rerender(<PlanBudgetsScreen />);
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockSettings.refetch).toHaveBeenCalledTimes(1);
  expect(mockTemplates.refetch).toHaveBeenCalledTimes(1);

  mockSettings.isError = false;
  mockTemplates.data = [];
  await view.rerender(<PlanBudgetsScreen />);
  await fireEvent.press(view.getByText("budgets.plan.viewTemplates"));
  expect(router.replace).toHaveBeenCalledWith("/templates");
});
