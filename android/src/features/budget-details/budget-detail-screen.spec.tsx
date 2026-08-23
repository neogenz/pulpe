import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import type {
  BudgetDetailsResponse,
  BudgetLine,
  Transaction,
} from "pulpe-shared";

import BudgetDetailScreen from "@/app/(main)/budget/[id]";

const mockDetailsRefetch = jest.fn(async () => undefined);
const mockSettingsRefetch = jest.fn(async () => undefined);
const mockToggleRequest = jest.fn();
const mockDetails = {
  data: undefined as BudgetDetailsResponse["data"] | undefined,
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: mockDetailsRefetch,
};
const mockSettings = {
  data: { currency: "CHF", payDayOfMonth: null },
  isPending: false,
  isError: false,
  refetch: mockSettingsRefetch,
};
const mockPeriodsByYear = new Map<
  number,
  { id: string; month: number; year: number }[]
>();
const mockUseBudgetPeriods = jest.fn((year: number | null) => ({
  data: year === null ? [] : (mockPeriodsByYear.get(year) ?? []),
}));
const mockToggle = {
  mutate: jest.fn(),
  isPending: false,
  variables: undefined,
};

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  return {
    router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: () => ({ id: "budget-1" }),
    useFocusEffect: (effect: () => void | (() => void)) =>
      React.useEffect(effect, [effect]),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: { View },
    LinearTransition: { duration: () => undefined },
  };
});
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  Object.defineProperty(actual, "FlatList", {
    value: ({
      data,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
    }: {
      data: { key: string }[];
      renderItem: (value: { item: { key: string } }) => React.ReactNode;
      ListHeaderComponent: React.ReactNode;
      ListEmptyComponent: React.ReactNode;
    }) => (
      <actual.View>
        {ListHeaderComponent}
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item) => (
              <actual.View key={item.key}>{renderItem({ item })}</actual.View>
            ))}
      </actual.View>
    ),
  });
  Object.defineProperty(actual, "RefreshControl", { value: () => null });
  return actual;
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, TextInput, View } =
    jest.requireActual("react-native");
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    Appbar: {
      BackAction: ({ onPress }: { onPress: () => void }) => (
        <Pressable accessibilityLabel="app-back" onPress={onPress} />
      ),
      Content: ({ title }: { title: string }) => <Text>{title}</Text>,
      Action: ({
        onPress,
        accessibilityLabel,
      }: {
        onPress: () => void;
        accessibilityLabel: string;
      }) => (
        <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} />
      ),
    },
    Searchbar: ({
      placeholder,
      value,
      onChangeText,
      onIconPress,
      onClearIconPress,
    }: {
      placeholder: string;
      value: string;
      onChangeText: (value: string) => void;
      onIconPress: () => void;
      onClearIconPress: () => void;
    }) => (
      <View>
        <TextInput
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={onChangeText}
        />
        <Pressable accessibilityLabel="close-search" onPress={onIconPress} />
        <Pressable
          accessibilityLabel="clear-search"
          onPress={onClearIconPress}
        />
      </View>
    ),
    Text,
    useTheme: () => ({
      colors: { background: "white", onSurfaceVariant: "gray" },
    }),
  };
});
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
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/date-format", () => ({
  formatMonthName: (month: number, year: number) => `${year}-${month}`,
}));
jest.mock("@/core/ui/theme", () => ({
  DURATION: { short: 100 },
  FAB_CLEARANCE: 80,
  SCREEN_PADDING: 16,
  SPACING: { sm: 8, md: 16, lg: 24 },
}));
jest.mock("@/core/tips/tips-store", () => ({
  armTip: jest.fn(),
  dismissTip: jest.fn(),
  useIsTipArmed: () => false,
}));
jest.mock("@/core/tips/tooltip", () => ({ Tooltip: () => null }));
jest.mock("@/features/tags/tag-selection", () => ({
  tagSummary: () => null,
}));
jest.mock("@/features/tags/tag-queries", () => ({
  useTags: () => ({ data: [] }),
}));
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => mockSettings,
}));
jest.mock("@/features/budgets/budget-queries", () => ({
  budgetKeys: {
    all: ["budgets"],
    detail: (id: string) => ["budgets", "detail", id],
  },
  invalidateBudgetData: jest.fn(async () => undefined),
  useBudgetDetails: () => mockDetails,
  useBudgetPeriods: (year: number | null) => mockUseBudgetPeriods(year),
}));
jest.mock("@/features/budgets/toggle-check-api", () => ({
  toggleCheck: (target: unknown) => mockToggleRequest(target),
}));
jest.mock("@/features/budgets/toggle-check-mutation", () => ({
  useToggleCheck: () => mockToggle,
}));
jest.mock("@/features/current-month/current-month-view-model", () => ({
  buildCurrentMonthViewModel: () => ({ ready: true }),
}));
jest.mock("./components/budget-detail-hero", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    BudgetDetailHero: ({ onPressMetrics }: { onPressMetrics: () => void }) => (
      <Pressable onPress={onPressMetrics}>
        <Text>open-metrics</Text>
      </Pressable>
    ),
  };
});
jest.mock("./components/budget-line-row", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    BudgetLineRow: ({
      item,
      onPress,
      onToggle,
    }: {
      item: { line: BudgetLine };
      onPress: () => void;
      onToggle: () => void;
    }) => (
      <View>
        <Pressable onPress={onPress}>
          <Text>{`line:${item.line.name}`}</Text>
        </Pressable>
        <Pressable onPress={onToggle}>
          <Text>{`toggle:${item.line.id}`}</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("./components/transaction-row", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    TransactionRow: ({
      transaction,
      onPress,
      onToggle,
    }: {
      transaction: Transaction;
      onPress: () => void;
      onToggle: () => void;
    }) => (
      <View>
        <Pressable onPress={onPress}>
          <Text>{`activity:${transaction.name}`}</Text>
        </Pressable>
        <Pressable onPress={onToggle}>
          <Text>{`toggle:${transaction.id}`}</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("./components/details-filter-bar", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    DetailsFilterBar: ({
      filters,
      onChange,
    }: {
      filters: { kind: string; checked: string; search: string };
      onChange: (filters: {
        kind: "all" | "income";
        checked: "all" | "unchecked";
        search: string;
      }) => void;
    }) => (
      <View>
        <Text>{`filters:${filters.kind}:${filters.checked}`}</Text>
        <Pressable
          onPress={() => onChange({ ...filters, checked: "all" } as never)}
        >
          <Text>show-all</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange({ ...filters, kind: "income" } as never)}
        >
          <Text>income-only</Text>
        </Pressable>
      </View>
    ),
  };
});
jest.mock("./components/month-pager", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    MonthPager: ({
      months,
      onSelect,
    }: {
      months: { id: string }[];
      onSelect: (id: string) => void;
    }) => (
      <View>
        {months.map((month) => (
          <Pressable key={month.id} onPress={() => onSelect(month.id)}>
            <Text>{`month:${month.id}`}</Text>
          </Pressable>
        ))}
      </View>
    ),
  };
});
jest.mock("./components/budget-detail-overlays", () => {
  const React = jest.requireActual("react");
  const { Text } = jest.requireActual("react-native");
  return {
    BudgetDetailOverlays: React.forwardRef(function TestBudgetDetailOverlays(
      _props: unknown,
      ref: React.ForwardedRef<unknown>,
    ) {
      const [message, setMessage] = React.useState("");
      React.useImperativeHandle(ref, () => ({
        editTransaction: (transaction: Transaction) =>
          setMessage(`edit:${transaction.id}`),
        showTransactionMenu: () => setMessage("transaction-menu"),
        showWithdrawal: () => setMessage("withdrawal"),
        showRealizedBalance: () => setMessage("realized"),
        showToggleFailure: () => setMessage("toggle-failure"),
      }));
      return <Text>{message}</Text>;
    }),
  };
});
jest.mock("./savings-withdrawal/components/tight-month-card", () => ({
  TightMonthCard: () => null,
}));
jest.mock("./savings-withdrawal/withdrawal-gate", () => ({
  dismissWithdrawal: jest.fn(),
  isWithdrawalDismissed: () => false,
  shouldOfferWithdrawal: () => false,
}));

function line(overrides: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: "rent",
    budgetId: "budget-1",
    templateLineId: null,
    savingsGoalId: null,
    name: "Loyer",
    amount: 1200,
    kind: "expense",
    recurrence: "fixed",
    isManuallyAdjusted: false,
    checkedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "coffee",
    budgetId: "budget-1",
    budgetLineId: null,
    name: "Café",
    amount: 4,
    kind: "expense",
    transactionDate: "2026-08-05T00:00:00.000Z",
    checkedAt: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

function readyDetails(): BudgetDetailsResponse["data"] {
  return {
    budget: {
      id: "budget-1",
      month: 8,
      year: 2026,
      description: "Août 2026",
      templateId: "template-1",
      rollover: 0,
      previousBudgetId: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    },
    budgetLines: [
      line(),
      line({
        id: "salary",
        name: "Salaire",
        kind: "income",
        amount: 4000,
        checkedAt: "2026-08-02T00:00:00.000Z",
      }),
    ],
    transactions: [transaction()],
    history: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockDetails, {
    data: undefined,
    isPending: false,
    isError: false,
    isRefetching: false,
  });
  Object.assign(mockSettings, {
    data: { currency: "CHF", payDayOfMonth: null },
    isPending: false,
    isError: false,
  });
  mockPeriodsByYear.clear();
});

it("distinguishes loading, retryable failure and a deleted budget", async () => {
  mockDetails.isPending = true;
  const view = await render(<BudgetDetailScreen />);
  expect(view.getByText("common.loading")).toBeTruthy();

  Object.assign(mockDetails, { isPending: false, isError: true });
  await view.rerender(<BudgetDetailScreen />);
  await fireEvent.press(view.getByText("common.retry"));
  expect(mockDetailsRefetch).toHaveBeenCalledTimes(1);
  expect(mockSettingsRefetch).toHaveBeenCalledTimes(1);

  mockDetails.isError = false;
  await view.rerender(<BudgetDetailScreen />);
  expect(view.getByText("budgets.detail.missingTitle")).toBeTruthy();
  await fireEvent.press(view.getByText("common.back"));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it("filters, searches and navigates between rendered budget months", async () => {
  mockDetails.data = readyDetails();
  mockPeriodsByYear.set(2026, [
    { id: "budget-1", month: 8, year: 2026 },
    { id: "budget-2", month: 9, year: 2026 },
  ]);
  const view = await render(<BudgetDetailScreen />);

  expect(view.getByText("line:Loyer")).toBeTruthy();
  expect(view.queryByText("line:Salaire")).toBeNull();
  expect(view.getByText("activity:Café")).toBeTruthy();

  await fireEvent.press(view.getByText("show-all"));
  expect(view.getByText("line:Salaire")).toBeTruthy();
  await fireEvent.press(view.getByLabelText("budgets.detail.search"));
  await fireEvent.changeText(
    view.getByLabelText("budgets.detail.search"),
    "Salaire",
  );
  expect(view.getByText("line:Salaire")).toBeTruthy();
  expect(view.queryByText("line:Loyer")).toBeNull();
  await fireEvent.press(view.getByLabelText("close-search"));
  expect(view.getByText("line:Loyer")).toBeTruthy();

  await fireEvent.press(view.getByText("month:budget-2"));
  expect(router.replace).toHaveBeenCalledWith("/budget/budget-2");
  expect(mockUseBudgetPeriods).toHaveBeenCalledWith(2026);
});

it("loads the previous-year neighbor when January opens directly", async () => {
  const details = readyDetails();
  details.budget.month = 1;
  details.budget.previousBudgetId = "budget-0";
  mockDetails.data = details;
  mockPeriodsByYear.set(2025, [{ id: "budget-0", month: 12, year: 2025 }]);
  mockPeriodsByYear.set(2026, [{ id: "budget-1", month: 1, year: 2026 }]);

  const view = await render(<BudgetDetailScreen />);

  expect(view.getByText("month:budget-0")).toBeTruthy();
  expect(view.getByText("month:budget-1")).toBeTruthy();
  expect(mockUseBudgetPeriods).toHaveBeenCalledWith(2025);
});

it("uses overlay handles for editing, metrics and rejected pointing", async () => {
  mockDetails.data = readyDetails();
  const view = await render(<BudgetDetailScreen />);

  await fireEvent.press(view.getByText("activity:Café"));
  expect(view.getByText("edit:coffee")).toBeTruthy();
  await fireEvent.press(view.getByText("open-metrics"));
  expect(view.getByText("realized")).toBeTruthy();

  await fireEvent.press(view.getByText("toggle:rent"));
  const callbacks = mockToggle.mutate.mock.calls[0][1] as {
    onError: () => void;
  };
  await act(() => callbacks.onError());
  expect(view.getByText("toggle-failure")).toBeTruthy();
});

it("restores cached detail when the optimistic point request is rejected", async () => {
  const { useToggleCheck } = jest.requireActual(
    "@/features/budgets/toggle-check-mutation",
  ) as typeof import("@/features/budgets/toggle-check-mutation");
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false, gcTime: Infinity },
      queries: { retry: false, gcTime: Infinity },
    },
  });
  const key = ["budgets", "detail", "budget-1"];
  const original = readyDetails();
  client.setQueryData(key, original);
  mockToggleRequest.mockRejectedValueOnce(new Error("offline"));
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useToggleCheck("budget-1"), { wrapper });

  await act(() =>
    hook.result.current.mutate({ source: "budgetLine", sourceId: "rent" }),
  );
  await waitFor(() => {
    const restored = client.getQueryData<BudgetDetailsResponse["data"]>(key);
    expect(restored?.budgetLines[0]?.checkedAt).toBeNull();
  });
  expect(client.getQueryData(key)).toEqual(original);
  await hook.unmount();
  client.clear();
});
