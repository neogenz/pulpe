import { fireEvent, render } from "@testing-library/react-native";
import {
  BudgetFormulas,
  type BudgetLine,
  getBudgetPeriodDates,
  type Transaction,
} from "pulpe-shared";

import { gapCauses } from "../calculation-presentation";
import type { CurrentMonthViewModel } from "../current-month-view-model";
import { heroPresentation } from "../home-hero-presentation";
import { CalculationSheet } from "./calculation-sheet";

let mockHidden = false;
jest.mock("@/core/i18n/locale-store", () => {
  const { translateForLocale } = jest.requireActual("@/core/i18n/i18n");
  return {
    useTranslation: () => ({
      t: (key: string, options?: object) =>
        translateForLocale("fr", key, options),
      locale: "fr",
    }),
  };
});
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => mockHidden,
  useAmountVisibility: (select: (state: object) => boolean) =>
    select({ areAmountsHidden: mockHidden }),
}));
jest.mock("@/core/ui/theme", () => ({ SPACING: { xs: 4, sm: 8, md: 16 } }));
jest.mock("@/core/ui/amount", () => {
  const { Text } = jest.requireActual("react-native");
  return { Amount: Text };
});
jest.mock("@/core/ui/ledger", () => {
  const { Text, View } = jest.requireActual("react-native");
  return {
    LedgerCard: View,
    LedgerRow: ({
      title,
      subtitle,
      trailing,
    }: {
      title: string;
      subtitle?: string;
      trailing: React.ReactNode;
    }) => (
      <View>
        <Text>{title}</Text>
        {subtitle !== undefined && <Text>{subtitle}</Text>}
        {trailing}
      </View>
    ),
  };
});
jest.mock("@/core/ui/section-header", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    SectionHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
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
        primary: "green",
      },
    }),
  };
});

const line = (
  id: string,
  name: string,
  kind: BudgetLine["kind"],
  amount: number,
) => ({ id, name, kind, amount, recurrence: "fixed" }) as BudgetLine;
const movement = (
  name: string,
  amount: number,
  budgetLineId: string | null = null,
) =>
  ({
    id: name,
    name,
    amount,
    kind: "expense",
    budgetLineId,
  }) as Transaction;

const budgetLines = [
  line("salary", "Salaire", "income", 6000),
  line("groceries", "Courses", "expense", 500),
  line("savings", "Épargne", "saving", 300),
];
const transactions = [
  movement("Supermarché", 650, "groceries"),
  movement("Resto", 40),
  movement("Cadeau", 80),
];
// The month's own metrics, as the view model computes them: the formula has to land on them.
const metrics = BudgetFormulas.calculateAllMetrics(
  budgetLines,
  transactions,
  200,
);
const viewModel = {
  metrics,
  realized: { realizedBalance: 1234.5 },
  driftLines: [
    {
      line: budgetLines[1],
      consumption: { allocated: 650, available: -150, percentage: 130 },
    },
  ],
  trajectory: null,
} as unknown as CurrentMonthViewModel;

function renderSheet(onReconcile?: () => void) {
  return render(
    <CalculationSheet
      isVisible
      onDismiss={jest.fn()}
      viewModel={viewModel}
      presentation={heroPresentation({
        estimatedBalance: metrics.remaining,
        fallbackPlannedBalance: 5400,
        trajectory: null,
      })}
      budgetLines={budgetLines}
      transactions={transactions}
      currency="CHF"
      month={11}
      year={2026}
      periodEnd={getBudgetPeriodDates(11, 2026, null).endDate}
      onReconcile={onReconcile}
    />,
  );
}

beforeEach(() => {
  mockHidden = false;
});

it("writes the disponible as a formula that adds up to it", async () => {
  const view = await renderSheet();

  expect(metrics.remaining).toBe(5130);
  expect(view.getByText("Disponible à dépenser en novembre")).toBeTruthy();
  expect(view.getByText("5’130.00 CHF")).toBeTruthy();
  for (const [title, amount] of [
    ["Salaire", "+6’000.00"],
    ["Report d'octobre", "+200.00"],
    ["Dépenses prévues", "−650.00"],
    ["Hors prévision", "−120.00"],
    ["Épargne prévue", "−300.00"],
    ["Disponible à dépenser", "5’130.00"],
  ]) {
    expect(view.getByText(title)).toBeTruthy();
    expect(view.getByText(amount)).toBeTruthy();
  }
  expect(view.getByText("Le plus haut entre prévu et dépensé")).toBeTruthy();
  expect(view.getByText("Sans prévision")).toBeTruthy();
});

it("explains the gap to the plan by its overruns and unplanned expenses", async () => {
  const view = await renderSheet();

  expect(view.getByText("Par rapport à ton plan")).toBeTruthy();
  expect(view.getByText("Écart au plan")).toBeTruthy();
  expect(view.getByText("−270.00")).toBeTruthy();
  expect(view.getByText("Prévu au départ : 5’400.00")).toBeTruthy();
  expect(
    view.getByText("Courses +150.00, Cadeau 80.00 et Resto 40.00."),
  ).toBeTruthy();
});

it("leads from the pointed balance to the reconciliation", async () => {
  const onReconcile = jest.fn();
  const view = await renderSheet(onReconcile);

  expect(
    view.getByText(
      "Ton solde pointé : 1’234.50, ce que donnent tes mouvements pointés.",
    ),
  ).toBeTruthy();
  await fireEvent.press(view.getByText("Comparer avec mes comptes"));
  expect(onReconcile).toHaveBeenCalledTimes(1);
});

it("offers no reconciliation without a loaded budget", async () => {
  const view = await renderSheet();
  expect(view.queryByText("Comparer avec mes comptes")).toBeNull();
});

it("drops the signs along with the figures while amounts are hidden", async () => {
  mockHidden = true;
  const view = await renderSheet();

  expect(view.queryByText(/^[+−]•••$/)).toBeNull();
  expect(view.getByText("Courses +•••, Cadeau ••• et Resto •••.")).toBeTruthy();
});

it("names two causes then counts the rest", () => {
  const t = (key: string, options?: object) =>
    jest
      .requireActual("@/core/i18n/i18n")
      .translateForLocale("fr", key, options);
  const overruns = ["A", "B", "C", "D"].map((name) => ({ name, overrun: 1 }));
  const plain = (value: number) => String(value);

  expect(gapCauses(t, [], [], plain)).toBeNull();
  expect(gapCauses(t, overruns.slice(0, 1), [], plain)).toBe("A +1.");
  expect(gapCauses(t, overruns.slice(0, 3), [], plain)).toBe(
    "A +1, B +1 et C +1.",
  );
  expect(gapCauses(t, overruns, [], plain)).toBe("A +1, B +1 et 2 autres.");
});
