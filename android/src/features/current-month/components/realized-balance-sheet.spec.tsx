import { fireEvent, render } from "@testing-library/react-native";
import { getBudgetPeriodForDate } from "pulpe-shared";

import { RealizedBalanceSheet } from "./realized-balance-sheet";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: "fr" }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));
jest.mock("@/core/ui/haptics", () => ({ hapticSelection: jest.fn() }));
jest.mock("@/core/ui/scheme-colors", () => ({
  useFinancialColors: () => ({
    income: "#0000FF",
    expense: "#FFBF00",
    savings: "#008000",
    overBudget: "#FFA500",
  }),
  useHeroColors: () => ({
    surfaceTop: "darkgreen",
    surface: "green",
    support: "mint",
    muted: "gray",
    positive: "lime",
    caution: "amber",
    ink: "white",
  }),
}));
jest.mock("@/core/ui/theme", () => ({
  ICON_SIZE: { sm: 16, md: 20 },
  RADIUS: { card: 18, md: 24, full: 999 },
  SPACING: { xxs: 2, xs: 4, sm: 8, md: 16, lg: 24 },
  TABULAR_DIGITS: {},
  TINT_ALPHA: { surface: "1F", icon: "26" },
}));
jest.mock("@/core/ui/amount", () => {
  const { Text } = jest.requireActual("react-native");
  return { Amount: Text };
});
jest.mock("@/core/ui/hero", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    HeroFigure: ({ amount }: { amount: string }) => <Text>{amount}</Text>,
    HeroProgress: ({ label }: { label: string }) => <Text>{label}</Text>,
  };
});
jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => () => null);
jest.mock("expo-linear-gradient", () => {
  const { View } = jest.requireActual("react-native");
  return { LinearGradient: View };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text } = jest.requireActual("react-native");
  return {
    Button: ({
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
    Text,
    useTheme: () => ({
      colors: {
        onSurface: "black",
        onSurfaceVariant: "gray",
        outlineVariant: "silver",
        surface: "white",
      },
    }),
  };
});
jest.mock("@/core/ui/sheet", () => {
  const { View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      children,
      footer,
    }: {
      children: React.ReactNode;
      footer?: React.ReactNode;
    }) => (
      <View>
        {children}
        {footer}
      </View>
    ),
  };
});
jest.mock("@/core/user-settings/user-settings-queries", () => ({
  useUserSettings: () => ({ data: { payDayOfMonth: null } }),
}));

const period = getBudgetPeriodForDate(new Date(), null);
const mockBudgets = [1180, -640, 1420].map((remaining, offset) => {
  const date = new Date(period.year, period.month - 1 + offset, 1);
  return {
    id: `budget-${offset}`,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    remaining,
  };
});
jest.mock("@/features/budgets/budget-queries", () => ({
  useBudgetList: () => ({ data: mockBudgets }),
}));

const props = {
  isVisible: true,
  onDismiss: jest.fn(),
  metrics: {
    totalIncome: 5000,
    totalExpenses: 4000,
    totalSavings: 300,
    remaining: 1000,
  },
  realized: {
    realizedIncome: 5000,
    realizedExpenses: 3380.01,
    realizedSpending: 3080.01,
    realizedSavings: 300,
    realizedBalance: 1499.99,
    checkedItemsCount: 4,
    totalItemsCount: 6,
  },
  currency: "CHF" as const,
} as unknown as React.ComponentProps<typeof RealizedBalanceSheet>;

it("offers to reconcile the accounts from the realized balance", async () => {
  const onReconcile = jest.fn();
  const view = await render(
    <RealizedBalanceSheet {...props} onReconcile={onReconcile} />,
  );

  await fireEvent.press(view.getByText("home.reconcile.title"));

  expect(onReconcile).toHaveBeenCalledTimes(1);
});

it("offers nothing where no active budget can be reconciled", async () => {
  const view = await render(<RealizedBalanceSheet {...props} />);

  expect(view.queryByText("home.reconcile.title")).toBeNull();
});

it("adds the pointed balance up to what is left to spend", async () => {
  const view = await render(<RealizedBalanceSheet {...props} />);

  expect(
    view.getByText(
      "1’499.99 home.realized.bridge.checked − 499.99 home.realized.bridge.outgoing = 1’000.00 home.realized.bridge.available",
    ),
  ).toBeTruthy();
});

it("adds what is still to come in before what is still to go out", async () => {
  const view = await render(
    <RealizedBalanceSheet
      {...props}
      realized={{
        ...props.realized,
        realizedIncome: 4000,
        realizedBalance: 499.99,
      }}
    />,
  );

  expect(
    view.getByText(
      "499.99 home.realized.bridge.checked + 1’000.00 home.realized.bridge.incoming − 499.99 home.realized.bridge.outgoing = 1’000.00 home.realized.bridge.available",
    ),
  ).toBeTruthy();
});

it("lands on the deficit when the plan is overspent", async () => {
  const view = await render(
    <RealizedBalanceSheet
      {...props}
      metrics={{ ...props.metrics, remaining: -200 }}
    />,
  );

  expect(
    view.getByText(
      "1’499.99 home.realized.bridge.checked − 1’699.99 home.realized.bridge.outgoing = 200.00 home.realized.bridge.deficit",
    ),
  ).toBeTruthy();
});

it("leaves the coming months out of a past month", async () => {
  const past = new Date(period.year, period.month - 2, 1);
  const view = await render(
    <RealizedBalanceSheet
      {...props}
      period={{ month: past.getMonth() + 1, year: past.getFullYear() }}
    />,
  );

  expect(view.queryByText("home.realized.forecast.title")).toBeNull();
});

it("labels each coming month's bar with its amount", async () => {
  const view = await render(<RealizedBalanceSheet {...props} />);

  for (const label of ["1’180", "-640", "1’420"]) {
    expect(view.getByText(label)).toBeTruthy();
  }
  expect(
    view.getByText("home.realized.forecast.outlook.tightens"),
  ).toBeTruthy();
});

it("reads the tapped month above the bars", async () => {
  const view = await render(<RealizedBalanceSheet {...props} />);
  const [, tapped] = view.getAllByRole("button");

  await fireEvent.press(tapped);

  expect(tapped.props.accessibilityState).toEqual({ selected: true });
  expect(view.getByText("-640 CHF")).toBeTruthy();
  expect(view.queryByText("1’180 CHF")).toBeNull();
});
