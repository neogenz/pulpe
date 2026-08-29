import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";
import type { BudgetSparse } from "pulpe-shared";

import BudgetsScreen from "@/app/(main)/(tabs)/budgets";

import { uniqueBudgets } from "./budget-list-selectors";

const mockScrollToLocation = jest.fn();
const mockInvalidateBudgets = jest.fn(async () => undefined);
const mockRefetchStaleList = jest.fn(async () => undefined);
const mockInvalidateSettings = jest.fn(async () => undefined);
const mockBudgets = {
  data: [] as BudgetSparse[],
  isPending: false,
  isError: false,
  isRefetching: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(async () => undefined),
};
const mockSettings = {
  data: { currency: "CHF", payDayOfMonth: 1 },
  isPending: false,
  isError: false,
};

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => React.useEffect(effect, [effect]),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const React = jest.requireActual("react");
  const SectionList = React.forwardRef(
    (
      {
        sections,
        renderSectionHeader,
        renderItem,
        ListHeaderComponent,
        ListFooterComponent,
        onContentSizeChange,
        onScrollToIndexFailed,
        onEndReached,
      }: {
        sections: { year: number; data: BudgetSparse[] }[];
        renderSectionHeader: (value: {
          section: { year: number; data: BudgetSparse[] };
        }) => React.ReactNode;
        renderItem: (value: { item: BudgetSparse }) => React.ReactNode;
        ListHeaderComponent: React.ReactNode;
        ListFooterComponent: React.ReactNode;
        onContentSizeChange: () => void;
        onScrollToIndexFailed: () => void;
        onEndReached: () => void;
      },
      ref: React.ForwardedRef<{
        scrollToLocation: typeof mockScrollToLocation;
      }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        scrollToLocation: mockScrollToLocation,
      }));
      return (
        <actual.View>
          {ListHeaderComponent}
          {sections.map((section) => (
            <actual.View key={section.year}>
              {renderSectionHeader({ section })}
              {section.data.map((item) => (
                <actual.View key={item.id}>{renderItem({ item })}</actual.View>
              ))}
            </actual.View>
          ))}
          {ListFooterComponent}
          <actual.Pressable
            testID="anchor-list"
            onPress={onContentSizeChange}
          />
          <actual.Pressable
            testID="retry-anchor"
            onPress={onScrollToIndexFailed}
          />
          <actual.Pressable testID="load-more" onPress={onEndReached} />
        </actual.View>
      );
    },
  );
  SectionList.displayName = "TestSectionList";
  Object.defineProperty(actual, "SectionList", { value: SectionList });
  Object.defineProperty(actual, "RefreshControl", { value: () => null });
  return actual;
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    FAB: ({
      onPress,
      accessibilityLabel,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
    }) => (
      <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} />
    ),
    List: { Subheader: Text },
    Text,
    useTheme: () => ({
      colors: {
        background: "white",
        onSurfaceVariant: "gray",
        primary: "purple",
      },
    }),
  };
});
jest.mock("@/core/ui/tab-header", () => {
  const { Text } = jest.requireActual("react-native");
  return { TabHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock("@/core/ui/card", () => {
  const { Pressable, View } = jest.requireActual("react-native");
  return {
    Card: Object.assign(
      ({
        children,
        onPress,
      }: {
        children: React.ReactNode;
        onPress: () => void;
      }) => <Pressable onPress={onPress}>{children}</Pressable>,
      { Content: View },
    ),
  };
});
jest.mock("@/core/ui/amount", () => ({
  Amount: ({ children }: { children: React.ReactNode }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{children}</Text>;
  },
}));
jest.mock("@/core/ui/status-badge", () => ({
  StatusBadge: ({ children }: { children: React.ReactNode }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{children}</Text>;
  },
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
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: jest.fn(),
}));
jest.mock("@/core/ui/amount-format", () => ({
  formatSignedCompactCurrency: (amount: number) => `amount:${amount}`,
}));
jest.mock("@/core/ui/date-format", () => ({
  formatDayMonth: (date: Date) => date.toISOString().slice(0, 10),
  formatMonthName: (month: number, year: number) => `month:${year}-${month}`,
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/theme", () => ({
  FAB_CLEARANCE: 80,
  SPACING: { xxs: 2, sm: 8, md: 16 },
}));
jest.mock("@/features/budgets/month-subtitle", () => ({
  monthSubtitle: () => "month-subtitle",
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  invalidateUserSettings: () => mockInvalidateSettings(),
  useUserSettings: () => mockSettings,
}));
jest.mock("@/features/budgets/budget-queries", () => ({
  invalidateBudgetData: () => mockInvalidateBudgets(),
  refetchStaleBudgetList: () => mockRefetchStaleList(),
  useBudgetList: () => mockBudgets,
}));

function budget(
  id: string,
  month: number,
  year: number,
  remaining = 100,
): BudgetSparse {
  return { id, month, year, remaining };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockBudgets, {
    data: [],
    isPending: false,
    isError: false,
    isRefetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
  });
  Object.assign(mockSettings, {
    data: { currency: "CHF", payDayOfMonth: 1 },
    isPending: false,
    isError: false,
  });
});

it("asks once for a stale list when the tab gains focus", async () => {
  await render(<BudgetsScreen />);

  expect(mockRefetchStaleList).toHaveBeenCalledTimes(1);
});

it("renders loading, retryable failure and empty creation states", async () => {
  mockBudgets.isPending = true;
  const view = await render(<BudgetsScreen />);
  expect(view.getByText("common.loading")).toBeTruthy();

  Object.assign(mockBudgets, { isPending: false, isError: true });
  await view.rerender(<BudgetsScreen />);
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockInvalidateSettings).toHaveBeenCalledTimes(1);
  expect(mockInvalidateBudgets).toHaveBeenCalledTimes(1);

  mockBudgets.isError = false;
  await view.rerender(<BudgetsScreen />);
  await fireEvent.press(view.getByText("budgets.list.create"));
  expect(router.push).toHaveBeenCalledWith("/budget/create");
});

it("anchors the current month, paginates and opens selected budgets", async () => {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const future = new Date(currentYear, currentMonth, 1);
  mockBudgets.data = [
    budget("future", future.getMonth() + 1, future.getFullYear()),
    budget("current", currentMonth, currentYear),
    budget("old", 12, currentYear - 1, -20),
  ];
  Object.assign(mockBudgets, { hasNextPage: true });

  const view = await render(<BudgetsScreen />);
  expect(view.getByText(String(currentYear))).toBeTruthy();
  expect(view.getByText(String(currentYear - 1))).toBeTruthy();

  await fireEvent.press(view.getByTestId("anchor-list"));
  expect(mockScrollToLocation).toHaveBeenCalledWith(
    expect.objectContaining({ animated: false, itemIndex: expect.any(Number) }),
  );
  await fireEvent.press(view.getByTestId("retry-anchor"));

  await fireEvent.press(view.getByText(`month:${currentYear}-${currentMonth}`));
  expect(router.push).toHaveBeenCalledWith("/budget/current");
  await fireEvent.press(view.getByTestId("load-more"));
  expect(mockBudgets.fetchNextPage).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    view.getByLabelText("budgets.list.createAccessibility"),
  );
  expect(router.push).toHaveBeenCalledWith("/budget/create");
});

it("keeps one stable row when consecutive pages overlap", () => {
  const first = budget("shared", 8, 2026, 100);
  const duplicate = budget("shared", 8, 2026, 90);
  const merged = uniqueBudgets([
    [first],
    [duplicate, budget("older", 7, 2026)],
  ]);

  expect(merged.map((item) => item.id)).toEqual(["shared", "older"]);
  expect(merged[0]).toBe(first);
});
