import { fireEvent, render } from "@testing-library/react-native";
import type {
  BudgetLine,
  ReconciliationContext,
  Transaction,
} from "pulpe-shared";
import { AccessibilityInfo, Text } from "react-native";

import { buildComparison } from "../reconciliation";
import {
  arrowed,
  money,
  ReconcileCompareActions,
  ReconcileCompareStep,
} from "./reconcile-compare-step";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr-CH",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${Object.values(params).join("|")}`,
  }),
}));
let mockFontScale = 1;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ fontScale: mockFontScale, width: 393, height: 852 }),
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
  realizedBefore: null,
  isDismissed: false,
  payDayOfMonth: null,
  today: new Date(2026, 10, 18),
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
    onAddOwe: jest.fn(),
    onEditStartingAmount: jest.fn(),
    ...overrides,
  };
  return { props, view: render(<ReconcileCompareStep {...props} />) };
}

beforeEach(() => {
  mockAmountsHidden = false;
  mockFontScale = 1;
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

it("puts each amount under its words at a large font, and lets « Voir les autres » wrap", async () => {
  // A refund cannot explain money missing: it stays for « Voir les autres ».
  const refund = {
    ...essence,
    id: "t-refund",
    name: "Remboursement",
    kind: "income" as const,
  };
  const comparison = buildComparison({
    ...happyPath,
    transactions: [essence, refund],
  });
  const atNormalSize = await renderStep(comparison).view;
  expect(
    atNormalSize.getByText("home.reconcile.compare.onAccounts").parent,
  ).toHaveStyle({ flexDirection: "row" });
  expect(atNormalSize.getByText("Essence").props.numberOfLines).toBe(2);

  mockFontScale = 2;
  const larger = await renderStep(comparison).view;
  expect(
    larger.getByText("home.reconcile.compare.onAccounts").parent,
  ).not.toHaveStyle({ flexDirection: "row" });
  // The name wraps instead of « Épa… », its amount on a line of its own.
  expect(larger.getByText("Essence").props.numberOfLines).toBeUndefined();
  // Assurance, Essence, Pharmacie: the amount stays in Essence's row.
  expect(larger.getAllByTestId("reconcile-suggestion")[1]).toHaveTextContent(
    /Essence.*60\.00\sCHF/,
  );
  // Not Paper's one-line button label: « Voir les 11 autres à poi… ».
  expect(
    larger.getByText("home.reconcile.compare.othersOne:1").props.numberOfLines,
  ).toBeUndefined();
});

it("strikes the old figure through and shows what was found after a partial check", async () => {
  const view = await renderStep(
    buildComparison({
      ...happyPath,
      realizedBalance: 990,
      transactions: [{ ...essence, checkedAt: STAMP }],
      comparedBefore: 1050,
      realizedBefore: 1050,
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
      context: { ...context, priorCorrection: 20 },
      comparedBefore: 1050,
      realizedBefore: 1050,
    }),
  ).view;

  expect(view.getByTestId("reconcile-step-heading")).toHaveTextContent(
    "home.reconcile.compare.less:•••",
  );
  expect(view.getByTestId("reconcile-in-pulpe").props).toMatchObject({
    accessibilityLabel:
      "home.reconcile.compare.inPulpe, •••, home.reconcile.compare.instead:•••",
  });
  expect(view.getByTestId("reconcile-prior-correction")).toHaveTextContent(
    "home.reconcile.compare.priorCorrectionPart:•••",
  );
  expect(view.queryByText(/\d\.\d\d/)).toBeNull();
});

it("writes an amount below zero with a true minus, as on web and iOS", () => {
  expect(money(-1234.56, "CHF")).toBe("−1’234.56 CHF");
});

it("draws the note's arrow in the icon font, which Roboto lacks", async () => {
  const note = await render(
    <Text testID="note">{arrowed("Disponible : 9.00 → 5.00", 12)}</Text>,
  );
  expect(note.getByTestId("note")).toHaveTextContent(
    "Disponible : 9.00 \u{F0054} 5.00",
  );
  expect(arrowed("Pas de flèche", 12)).toBe("Pas de flèche");
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

describe("more on the accounts", () => {
  // 6 000 more on the accounts than the 1 050 checked, nothing to check.
  const more = {
    ...happyPath,
    onAccountsCents: 705_000,
    budgetLines: [],
    transactions: [],
    context: { ...context, priorItems: [] },
  };

  it("asks about the salary only with a pay day five days away or less", async () => {
    const early = await renderStep(
      buildComparison({
        ...more,
        payDayOfMonth: 25,
        today: new Date(2026, 10, 23),
      }),
    ).view;
    expect(early.getByTestId("reconcile-salary-early")).toHaveTextContent(
      /home\.reconcile\.compare\.salaryComeBack:25/,
    );

    const later = await renderStep(
      buildComparison({
        ...more,
        payDayOfMonth: 25,
        today: new Date(2026, 10, 10),
      }),
    ).view;
    expect(later.queryByTestId("reconcile-salary-early")).toBeNull();
    expect(later.getByTestId("reconcile-large-gap")).toBeTruthy();
  });

  it("asks about a card only when no « Je dois » row was typed", async () => {
    const { props, view: pending } = renderStep(buildComparison(more));
    const view = await pending;
    await fireEvent.press(view.getByText("home.reconcile.accounts.addOwe"));
    expect(props.onAddOwe).toHaveBeenCalledTimes(1);

    const withOwe = await renderStep(buildComparison(more), { hasOwe: true })
      .view;
    expect(withOwe.queryByTestId("reconcile-card-question")).toBeNull();
    expect(withOwe.getByTestId("reconcile-large-gap")).toBeTruthy();
  });

  it("shows the money from before Pulpe apart from the figure, and opens it", async () => {
    const { props, view: pending } = renderStep(
      buildComparison({
        ...more,
        onAccountsCents: 400_000,
        realizedBalance: 900,
        context: { ...more.context, startingAmount: 3100 },
      }),
    );
    const view = await pending;

    expect(view.getByText("home.reconcile.compare.matched")).toBeTruthy();
    await fireEvent.press(view.getByTestId("reconcile-starting-amount"));
    expect(props.onEditStartingAmount).toHaveBeenCalledTimes(1);

    const partly = await renderStep(
      buildComparison({
        ...more,
        onAccountsCents: 410_000,
        realizedBalance: 900,
        context: { ...more.context, startingAmount: 3100 },
      }),
    ).view;
    expect(partly.getByTestId("reconcile-in-pulpe")).toHaveTextContent(
      /900\.00/,
    );
    expect(partly.getByTestId("reconcile-starting-amount")).toHaveTextContent(
      /home\.reconcile\.compare\.startingAmountPart:\+3’100\.00/,
    );
    expect(partly.queryByTestId("reconcile-prior-correction")).toBeNull();
  });

  it("starts the matched card from the accounts figure, so the sum adds up", async () => {
    const view = await renderStep(
      buildComparison({
        ...more,
        onAccountsCents: 412_000,
        realizedBalance: 1020,
        available: 700,
        context: { ...more.context, startingAmount: 3100 },
      }),
    ).view;

    expect(view.getByTestId("reconcile-matched")).toHaveTextContent(
      /^home\.reconcile\.compare\.onAccounts4’120\.00 CHF.*stillPlanned−320\.00 CHF.*beforePulpe−3’100\.00 CHF.*toSpend700\.00 CHF$/,
    );
  });

  it("shows the Accueil's figure, then what earlier months left unchecked and the money from before Pulpe", async () => {
    // 900 checked this month, an Assurance of 120 left unchecked last month.
    const view = await renderStep(
      buildComparison({
        ...more,
        realizedBalance: 900,
        context: {
          ...more.context,
          priorCorrection: 120,
          startingAmount: 3100,
        },
      }),
    ).view;

    expect(view.getByTestId("reconcile-in-pulpe")).toHaveTextContent(
      "home.reconcile.compare.inPulpe900.00 CHF",
    );
    expect(view.getByTestId("reconcile-figures")).toHaveTextContent(
      /priorCorrectionPart:\+120\.00 CHF.*startingAmountPart:\+3’100\.00 CHF/,
    );
  });
});

describe("a saving among the suggestions", () => {
  // Last month's, as the server sends it: a prévision whose money is a saving.
  const vacances = {
    ...context.priorItems[0],
    id: "l-vacances",
    source: "budgetLine" as const,
    name: "Vacances",
    kind: "saving" as const,
  };
  const withSaving = buildComparison({
    ...happyPath,
    context: { ...context, priorItems: [vacances] },
  });

  function renderActions(comparison: ReturnType<typeof buildComparison>) {
    return render(
      <ReconcileCompareActions
        comparison={comparison}
        currency="CHF"
        isBusy={false}
        isRecording={false}
        isSavingState={false}
        onLeave={jest.fn()}
        onDismiss={jest.fn()}
        onRecord={jest.fn()}
        onKeep={jest.fn()}
        onShowReasons={jest.fn()}
      />,
    );
  }

  it("names the savings in the lead and lets nothing match", async () => {
    const view = await renderStep(withSaving).view;
    expect(view.getAllByTestId("reconcile-suggestion")[2]).toHaveTextContent(
      /Vacances/,
    );
    expect(
      view.getByText("home.reconcile.compare.leadExpenseSaving"),
    ).toBeTruthy();
    const actions = await renderActions(withSaving);
    expect(
      actions.getByText("home.reconcile.compare.nothingMatches"),
    ).toBeTruthy();
  });

  it("keeps the card's lead with a « Je dois » row", async () => {
    const view = await renderStep(withSaving, { hasOwe: true }).view;
    expect(view.getByText("home.reconcile.compare.leadCard")).toBeTruthy();
  });

  it("keeps the expense texts without a saving", async () => {
    const comparison = buildComparison(happyPath);
    const view = await renderStep(comparison).view;
    expect(view.getByText("home.reconcile.compare.leadExpense")).toBeTruthy();
    const actions = await renderActions(comparison);
    expect(
      actions.getByText("home.reconcile.compare.noExpenseMatches"),
    ).toBeTruthy();
  });
});

it("asks about less on the accounts with a true minus, as on web and iOS", async () => {
  const view = await renderStep(
    buildComparison({
      ...happyPath,
      onAccountsCents: 50_000,
      budgetLines: [],
      transactions: [],
      context: { ...context, priorItems: [] },
    }),
  ).view;

  expect(view.getByTestId("reconcile-large-gap")).toHaveTextContent(
    "home.reconcile.compare.largeGapQuestion:−550.00 CHF",
  );
});
