import { fireEvent, render } from "@testing-library/react-native";
import type {
  BudgetLine,
  ReconciliationContext,
  Transaction,
} from "pulpe-shared";
import { AccessibilityInfo } from "react-native";

import { buildComparison } from "../reconciliation";
import { money, ReconcileCompareStep } from "./reconcile-compare-step";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr-CH",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${Object.values(params).join("|")}`,
  }),
}));
let mockAmountsHidden = false;
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => mockAmountsHidden,
}));

const STAMP = "2026-11-18T10:00:00.000Z";
const assurance: BudgetLine = {
  id: "l-assurance",
  budgetId: "budget-1",
  templateLineId: null,
  savingsGoalId: null,
  assetId: null,
  name: "Assurance",
  amount: 100,
  kind: "expense",
  recurrence: "fixed",
  isManuallyAdjusted: false,
  checkedAt: null,
  createdAt: STAMP,
  updatedAt: STAMP,
};
const essence: Transaction = {
  id: "t-essence",
  budgetId: "budget-1",
  budgetLineId: null,
  name: "Essence",
  amount: 60,
  kind: "expense",
  transactionDate: STAMP,
  checkedAt: null,
  createdAt: STAMP,
  updatedAt: STAMP,
};
const context: ReconciliationContext = {
  startingAmount: 0,
  hasCompletedComparison: true,
  priorCorrection: 0,
  priorItems: [
    {
      id: "t-pharmacie",
      source: "transaction",
      budgetId: "budget-0",
      name: "Pharmacie",
      amount: 40,
      kind: "expense",
      monthsAgo: 1,
      effect: -40,
    },
  ],
};
// Type 950 against 1 050 checked in Pulpe (spec phase 15, happy path).
const happyPath = {
  onAccountsCents: 95_000,
  realizedBalance: 1050,
  available: 900,
  budgetLines: [assurance],
  transactions: [essence],
  context,
  comparedBefore: null,
  isDismissed: false,
};

function renderStep(
  comparison: ReturnType<typeof buildComparison> | null,
  overrides: Partial<Parameters<typeof ReconcileCompareStep>[0]> = {},
) {
  const props = {
    comparison,
    isUnavailable: false,
    onRetry: jest.fn(),
    currency: "CHF" as const,
    hasOwe: false,
    oweTotal: null,
    checkingId: null,
    isBusy: false,
    onCheck: jest.fn(),
    onRemoveOwe: jest.fn(),
    onViewOthers: jest.fn(),
    ...overrides,
  };
  return { props, view: render(<ReconcileCompareStep {...props} />) };
}

beforeEach(() => {
  mockAmountsHidden = false;
});

it("lists the happy path's suggestions in order, each with where it comes from", async () => {
  const { props, view: pending } = renderStep(buildComparison(happyPath));
  const view = await pending;

  expect(view.getByTestId("reconcile-step-heading")).toHaveTextContent(
    "home.reconcile.compare.less:100.00 CHF",
  );
  const rows = view.getAllByTestId("reconcile-suggestion");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent(
    /Assurance.*home\.reconcile\.compare\.plannedThisMonth.*100\.00/,
  );
  expect(rows[1]).toHaveTextContent(/Essence.*18 novembre.*60\.00/);
  expect(rows[2]).toHaveTextContent(
    /Pharmacie.*home\.reconcile\.compare\.lastMonth.*40\.00/,
  );
  expect(view.queryByTestId("reconcile-found")).toBeNull();

  await fireEvent.press(rows[1]);
  expect(props.onCheck).toHaveBeenCalledWith(
    expect.objectContaining({ id: "t-essence", source: "transaction" }),
  );
});

it("strikes the old figure through and shows what was found after a partial check", async () => {
  const view = await renderStep(
    buildComparison({
      ...happyPath,
      realizedBalance: 990,
      transactions: [{ ...essence, checkedAt: STAMP }],
      comparedBefore: 1050,
    }),
  ).view;

  expect(view.getByTestId("reconcile-step-heading")).toHaveTextContent(
    "home.reconcile.compare.less:40.00 CHF",
  );
  expect(view.getByTestId("reconcile-compared-before")).toHaveTextContent(
    "1’050.00 CHF",
  );
  expect(view.getByTestId("reconcile-found")).toHaveTextContent(
    "home.reconcile.compare.found:60.00 CHF",
  );
  expect(view.getAllByTestId("reconcile-suggestion")).toHaveLength(1);
});

it("hands the focus to the next suggestion once a check settles", async () => {
  const focus = jest.spyOn(AccessibilityInfo, "sendAccessibilityEvent");
  const comparison = buildComparison(happyPath);
  const { props, view: pending } = renderStep(comparison);
  const view = await pending;
  await fireEvent.press(view.getAllByTestId("reconcile-suggestion")[1]);
  await view.rerender(
    <ReconcileCompareStep {...props} checkingId="t-essence" />,
  );
  focus.mockClear();

  await view.rerender(<ReconcileCompareStep {...props} checkingId={null} />);

  // The second row again: the same place, here still Essence, not the title.
  expect(focus).toHaveBeenCalledTimes(1);
  expect(focus.mock.calls[0][0]).toMatchObject({
    props: { testID: "reconcile-suggestion" },
  });
  focus.mockRestore();
});

it("masks the amounts alone, the words and the screen reader's « instead of » included", async () => {
  mockAmountsHidden = true;
  const view = await renderStep(
    buildComparison({
      ...happyPath,
      realizedBalance: 990,
      comparedBefore: 1050,
    }),
  ).view;

  expect(view.getByTestId("reconcile-step-heading")).toHaveTextContent(
    "home.reconcile.compare.less:•••",
  );
  expect(view.getByTestId("reconcile-in-pulpe").props).toMatchObject({
    accessibilityLabel:
      "home.reconcile.compare.inPulpe, •••, home.reconcile.compare.instead:•••",
  });
  expect(view.queryByText(/\d\.\d\d/)).toBeNull();
});

it("writes an amount below zero with a true minus, as on web and iOS", () => {
  expect(money(-1234.56, "CHF")).toBe("−1’234.56 CHF");
});

it("shows the error with [Réessayer] when the context cannot be read", async () => {
  const { props, view: pending } = renderStep(null, { isUnavailable: true });
  const view = await pending;

  expect(view.getByTestId("reconcile-context-error")).toHaveTextContent(
    /home\.reconcile\.compare\.loadError/,
  );
  await fireEvent.press(view.getByText("common.retry"));
  expect(props.onRetry).toHaveBeenCalledTimes(1);
  expect(view.queryByTestId("reconcile-figures")).toBeNull();
});
