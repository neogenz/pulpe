import { fireEvent, render } from "@testing-library/react-native";

import { RealizedBalanceSheet } from "./realized-balance-sheet";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => false,
}));
jest.mock("@/core/ui/scheme-colors", () => ({
  useFinancialColors: () => ({
    income: "blue",
    expense: "amber",
    savings: "green",
    overBudget: "orange",
  }),
}));
jest.mock("@/core/ui/theme", () => ({
  RADIUS: { card: 18, xs: 4 },
  SPACING: { md: 16, sm: 8, xs: 4 },
}));
jest.mock("@/core/ui/amount", () => {
  const { Text } = jest.requireActual("react-native");
  return { Amount: Text };
});
jest.mock("react-native-paper", () => {
  const { Pressable, Text, View } = jest.requireActual("react-native");
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
    Divider: () => <View />,
    Text,
    useTheme: () => ({
      colors: {
        onSurface: "black",
        onSurfaceVariant: "gray",
        surfaceVariant: "beige",
        outlineVariant: "silver",
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

const props = {
  isVisible: true,
  onDismiss: jest.fn(),
  metrics: { totalIncome: 5000, totalExpenses: 4000, totalSavings: 300 },
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
