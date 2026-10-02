import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import HomeScreen from "@/app/(main)/(tabs)/home";

const mockRefresh = jest.fn(async () => undefined);
const mockCurrentMonth = { status: "loading" } as Record<string, unknown>;
const mockBudgets = { data: [] as unknown[] };
const mockDeepLink = { isAddExpenseRequested: false };
const mockToggle = { mutateAsync: jest.fn(), isPending: false };
const mockReminders = {
  isVisible: false,
  offer: jest.fn(),
  dismiss: jest.fn(),
  enable: jest.fn(),
};

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  const Action = ({
    label,
    onPress,
    testID,
  }: {
    label?: string;
    onPress?: () => void;
    testID?: string;
  }) => (
    <Pressable onPress={onPress} testID={testID} accessibilityLabel={label}>
      <Text>{label}</Text>
    </Pressable>
  );
  return {
    ActivityIndicator: ({
      accessibilityLabel,
    }: {
      accessibilityLabel: string;
    }) => <Text>{accessibilityLabel}</Text>,
    Button: ({
      children,
      onPress,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
    }) => (
      <Pressable onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    FAB: ({
      onPress,
      accessibilityLabel,
      testID,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
      testID: string;
    }) => (
      <Action onPress={onPress} label={accessibilityLabel} testID={testID} />
    ),
    IconButton: ({
      onPress,
      accessibilityLabel,
      testID,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
      testID: string;
    }) => (
      <Action onPress={onPress} label={accessibilityLabel} testID={testID} />
    ),
    Divider: () => null,
    List: {
      Item: ({ title }: { title: string }) => <Text>{title}</Text>,
      Subheader: Text,
    },
    Text,
    useTheme: () => ({
      colors: { background: "white", onSurfaceVariant: "gray" },
    }),
    SegmentedButtons: () => null,
  };
});
jest.mock("@/core/ui/hero", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  const Children = ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  );
  return {
    HeroAppBar: ({
      title,
      children,
    }: {
      title: string;
      children?: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {children}
      </View>
    ),
    HeroAppBarAction: ({
      onPress,
      accessibilityLabel,
      testID,
    }: {
      onPress: () => void;
      accessibilityLabel: string;
      testID: string;
    }) => (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
      />
    ),
    HeroZone: Children,
    ContentZone: Children,
  };
});
jest.mock("@/core/ui/action-button", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    ActionButton: ({
      children,
      onPress,
      testID,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      testID?: string;
    }) => (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});
jest.mock("@/core/ui/theme", () => ({ SPACING: { md: 16 } }));
jest.mock("@/core/ui/scheme-colors", () => ({
  useHeroColors: () => ({ surface: "green", ink: "white" }),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  useAmountMasking: jest.fn(),
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
jest.mock("@/core/linking/deep-links", () => ({
  consumeAddExpenseRequest: jest.fn(),
  useDeepLinkStore: (selector: (state: typeof mockDeepLink) => unknown) =>
    selector(mockDeepLink),
}));
jest.mock("@/core/notifications/use-reminder-priming", () => ({
  useReminderPriming: () => mockReminders,
}));
jest.mock("@/core/tips/tips-store", () => ({ dismissTip: jest.fn() }));
jest.mock("@/core/tips/tooltip", () => ({ Tooltip: () => null }));
jest.mock("@/features/current-month/current-month-queries", () => ({
  useCurrentMonth: () => mockCurrentMonth,
}));
jest.mock("@/features/budgets/budget-queries", () => ({
  useBudgetList: () => mockBudgets,
}));
jest.mock("@/features/budgets/toggle-check-mutation", () => ({
  useToggleCheck: () => mockToggle,
  usePendingCheck: () => () => false,
}));
jest.mock("@/features/current-month/home-hero-presentation", () => ({
  heroPresentation: () => ({ absorbsEnvelopeOverrun: false }),
}));
jest.mock("@/features/current-month/components/home-hero-card", () => ({
  HomeHeroCard: () => null,
}));
jest.mock("@/features/current-month/components/home-hero-skeleton", () => {
  const { View } = jest.requireActual("react-native");
  return {
    HomeHeroSkeleton: () => (
      <View testID="home-hero-skeleton" accessibilityLabel="common.loading" />
    ),
  };
});
jest.mock("@/features/current-month/components/drift-card", () => ({
  DriftCard: () => null,
}));
jest.mock("@/features/current-month/components/savings-done-card", () => ({
  SavingsDoneCard: () => null,
}));
jest.mock("@/features/current-month/components/activity-card", () => ({
  ActivityCard: () => null,
}));
jest.mock("@/features/current-month/components/realized-balance-sheet", () => ({
  RealizedBalanceSheet: () => null,
}));
jest.mock(
  "@/features/current-month/components/notification-prime-sheet",
  () => ({ NotificationPrimeSheet: () => null }),
);
jest.mock(
  "@/features/current-month/components/unchecked-operations-card",
  () => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return {
      UncheckedOperationsCard: ({
        items,
        onToggle,
      }: {
        items: { id: string }[];
        onToggle: (item: { id: string; name: string }) => void;
      }) => (
        <Pressable
          onPress={() => onToggle(items[0] as { id: string; name: string })}
        >
          <Text>{`point:${items[0].id}`}</Text>
        </Pressable>
      ),
    };
  },
);
jest.mock("@/features/transactions/components/transaction-sheet", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    TransactionSheet: ({
      isVisible,
      onSaved,
      onDismiss,
    }: {
      isVisible: boolean;
      onSaved: () => void;
      onDismiss: () => void;
    }) =>
      isVisible ? (
        <View>
          <Text>add-sheet</Text>
          <Pressable onPress={onSaved}>
            <Text>save-entry</Text>
          </Pressable>
          <Pressable onPress={onDismiss}>
            <Text>close-entry</Text>
          </Pressable>
        </View>
      ) : null,
  };
});
jest.mock("@/core/ui/notice", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return {
    Notice: ({
      visible,
      children,
      action,
    }: {
      visible: boolean;
      children: React.ReactNode;
      action?: { label: string; onPress: () => void };
    }) =>
      visible ? (
        <View>
          <Text>{children}</Text>
          {action && (
            <Pressable onPress={action.onPress}>
              <Text>{action.label}</Text>
            </Pressable>
          )}
        </View>
      ) : null,
  };
});

function readyMonth() {
  return {
    status: "ready",
    budgetId: "budget-1",
    details: { budget: { month: 8, year: 2026 }, transactions: [] },
    currency: "CHF",
    payDayOfMonth: null,
    isRefreshing: false,
    refresh: mockRefresh,
    viewModel: {
      metrics: { remaining: 100, endingBalance: 100 },
      trajectory: [],
      driftLines: [],
      driftTotal: 0,
      savings: { isComplete: false, totalRealized: 0 },
      uncheckedCount: 1,
      uncheckedItems: [{ id: "item-1", name: "Courses", type: "transaction" }],
      daysRemaining: 5,
      realized: {},
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockCurrentMonth, { status: "loading" });
  mockBudgets.data = [];
  mockDeepLink.isAddExpenseRequested = false;
  Object.assign(mockReminders, { isVisible: false });
});

it("renders loading, retryable failure and empty creation states", async () => {
  const loading = await render(<HomeScreen />);
  expect(loading.getByTestId("home-hero-skeleton")).toBeTruthy();
  expect(loading.getByLabelText("common.loading")).toBeTruthy();
  // The mocked spinner prints its label as text; the skeleton only labels it.
  expect(loading.queryByText("common.loading")).toBeNull();

  Object.assign(mockCurrentMonth, { status: "failed", refresh: mockRefresh });
  await loading.rerender(<HomeScreen />);
  await fireEvent.press(loading.getByText("common.retry"));
  expect(mockRefresh).toHaveBeenCalledTimes(1);

  Object.assign(mockCurrentMonth, { status: "empty", viewModel: null });
  await loading.rerender(<HomeScreen />);
  await fireEvent.press(loading.getByText("home.states.createBudget"));
  expect(router.push).toHaveBeenCalledWith("/budget/create");
});

/**
 * The account was only ever reachable from the home's header, which the empty
 * and failed states used to drop — leaving no way to sign out or to fix the
 * pay day that emptied the month in the first place.
 */
it.each(["loading", "failed", "empty"])(
  "keeps the way to the account in the %s state",
  async (status) => {
    Object.assign(mockCurrentMonth, {
      status,
      viewModel: null,
      refresh: mockRefresh,
    });
    const view = await render(<HomeScreen />);

    await fireEvent.press(view.getByTestId("home-account"));

    expect(router.push).toHaveBeenCalledWith("/settings");
  },
);

it("opens addition from its action and a pending deep link", async () => {
  Object.assign(mockCurrentMonth, readyMonth());
  const view = await render(<HomeScreen />);
  await fireEvent.press(view.getByTestId("home-add-entry"));
  expect(view.getByText("add-sheet")).toBeTruthy();
  await fireEvent.press(view.getByText("save-entry"));
  expect(view.getByText("home.activity.added")).toBeTruthy();

  mockDeepLink.isAddExpenseRequested = true;
  await view.rerender(<HomeScreen />);
  expect(view.getByText("add-sheet")).toBeTruthy();
});

it("surfaces pointing and undo failures without hiding the recovery action", async () => {
  Object.assign(mockCurrentMonth, readyMonth());
  mockToggle.mutateAsync.mockRejectedValueOnce(new Error("offline"));
  const view = await render(<HomeScreen />);

  await fireEvent.press(view.getByText("point:item-1"));
  await waitFor(() =>
    expect(view.getByText("home.checking.pointFailure")).toBeTruthy(),
  );

  mockToggle.mutateAsync.mockResolvedValueOnce(undefined);
  await fireEvent.press(view.getByText("point:item-1"));
  await waitFor(() => expect(mockReminders.offer).toHaveBeenCalledTimes(1));

  mockToggle.mutateAsync.mockRejectedValueOnce(new Error("offline"));
  await fireEvent.press(view.getByText("common.cancel"));
  await waitFor(() =>
    expect(view.getByText("home.checking.undoFailure")).toBeTruthy(),
  );
});

/**
 * `mutate(vars, callbacks)` keeps only the latest call's callbacks: pointing a
 * second operation before the first answered dropped the first one's failure.
 */
it("says a pointing failed even when another was asked for meanwhile", async () => {
  Object.assign(mockCurrentMonth, readyMonth());
  let failFirst: (error: Error) => void = () => undefined;
  mockToggle.mutateAsync
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failFirst = reject;
        }),
    )
    .mockImplementationOnce(() => new Promise(() => undefined));
  const view = await render(<HomeScreen />);

  await fireEvent.press(view.getByText("point:item-1"));
  await fireEvent.press(view.getByText("point:item-1"));
  await act(async () => failFirst(new Error("offline")));

  expect(view.getByText("home.checking.pointFailure")).toBeTruthy();
});
