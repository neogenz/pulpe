import { fireEvent, render } from "@testing-library/react-native";

import {
  type ReasonsSnapshot,
  ReconcileReasonsSheet,
  reasonsFor,
} from "./reconcile-reasons-sheet";

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
  default: () => ({ fontScale: mockFontScale }),
}));
let mockAmountsHidden = false;
jest.mock("@/core/ui/amount-visibility", () => ({
  areAmountsHidden: () => mockAmountsHidden,
}));
jest.mock("@/core/ui/sheet", () => {
  const { Text, View } = jest.requireActual("react-native");
  return {
    FormModal: ({
      isVisible,
      title,
      children,
    }: {
      isVisible: boolean;
      title: string;
      children: React.ReactNode;
    }) =>
      isVisible ? (
        <View>
          <Text testID="sheet-title">{title}</Text>
          {children}
        </View>
      ) : null,
  };
});

// 6 000 more on the accounts; a 600 prévision checked with 200 spent on it.
const REASONS: ReasonsSnapshot = {
  gap: 6000,
  hasOwe: false,
  partlySpent: { name: "Courses", amount: 600, spent: 200, left: 400 },
  note: { before: 900, after: 6900 },
};

function renderSheet(overrides: Partial<ReasonsSnapshot> = {}) {
  const onChoose = jest.fn();
  const view = render(
    <ReconcileReasonsSheet
      isVisible
      reasons={{ ...REASONS, ...overrides }}
      currency="CHF"
      onDismiss={jest.fn()}
      onChoose={onChoose}
    />,
  );
  return { onChoose, view };
}

beforeEach(() => {
  mockAmountsHidden = false;
  mockFontScale = 1;
});

it("keeps three reasons at most, in a fixed order, each only when it holds", () => {
  expect(reasonsFor(false, true)).toEqual(["card", "partlySpent", "income"]);
  expect(reasonsFor(false, false)).toEqual(["card", "income", "savings"]);
  expect(reasonsFor(true, true)).toEqual(["partlySpent", "income", "savings"]);
  expect(reasonsFor(true, false)).toEqual(["income", "savings"]);
});

it("names the sheet without the amount, and shows each reason with its numbers", async () => {
  const view = await renderSheet().view;

  expect(view.getByTestId("sheet-title")).toHaveTextContent(
    "home.reconcile.reasons.label",
  );
  // Unnormalized: a non-breaking space there would cut the number at a large font.
  expect(
    view.getByText("home.reconcile.reasons.title:6’000.00 CHF", {
      normalizer: (text) => text,
    }),
  ).toBeTruthy();
  expect(view.getByTestId("reconcile-reason-card")).toHaveTextContent(
    /home\.reconcile\.reasons\.cardSample.*350\.00/,
  );
  expect(view.getByTestId("reconcile-reason-partlySpent")).toHaveTextContent(
    /Courses.*600\.00 CHF.*spent:200\.00 CHF.*left:400\.00 CHF/,
  );
  // Silent to TalkBack: found only among hidden elements.
  expect(view.queryByTestId("reconcile-reasons-bar")).toBeNull();
  expect(
    view.getByTestId("reconcile-reasons-bar", { includeHiddenElements: true }),
  ).toBeTruthy();
  expect(view.getByTestId("reconcile-reason-income")).toHaveTextContent(
    /noteIncome:6’000\.00 CHF.*availableNote:900\.00 CHF\|6’900\.00 CHF/,
  );
  expect(view.queryByTestId("reconcile-reason-savings")).toBeNull();
});

it("puts the card's pictures one under the other once half a 393 dp sheet cannot hold « ☑ Habits 350.00 »", async () => {
  // Half of the card on a 393 dp phone: « Habits » broke at 140.
  const halfCard = 152.5;
  const atNormalSize = await renderSheet().view;
  const basis = (view: typeof atNormalSize) =>
    Number(
      [view.getByTestId("reconcile-card-picture").props.style]
        .flat(Infinity)
        .reduce((last, style) => style?.flexBasis ?? last, 0),
    );
  expect(basis(atNormalSize)).toBeGreaterThan(halfCard);

  mockFontScale = 1.3;
  const larger = await renderSheet().view;
  expect(basis(larger)).toBeCloseTo(basis(atNormalSize) * 1.3);
  // A basis wider than a small phone still stays inside the card.
  expect(larger.getByTestId("reconcile-card-picture")).toHaveStyle({
    maxWidth: "100%",
  });
});

it("puts each amount under its name and wraps the buttons at a large font", async () => {
  const lines = (view: Awaited<ReturnType<typeof renderSheet>["view"]>) => [
    ...view.getAllByTestId("reconcile-reason-sample"),
    view.getByTestId("reconcile-reason-partly-spent-line"),
  ];
  const atNormalSize = await renderSheet({ hasOwe: true }).view;
  for (const line of lines(atNormalSize)) {
    expect(line).toHaveStyle({ flexDirection: "row" });
  }
  expect(atNormalSize.getByText("Courses").props.numberOfLines).toBe(1);

  mockFontScale = 2;
  const larger = await renderSheet({ hasOwe: true }).view;
  for (const line of lines(larger)) {
    expect(line).not.toHaveStyle({ flexDirection: "row" });
  }
  expect(larger.getByText("Courses").props.numberOfLines).toBeUndefined();
  // Paper's button would cut « Ajouter ce que je do… » on one line.
  const card = await renderSheet({ partlySpent: null }).view;
  for (const name of [
    "home.reconcile.accounts.addOwe",
    "home.reconcile.reasons.reviewAccounts",
  ]) {
    const button = card.getByRole("button", { name });
    expect(button).toHaveStyle({ minHeight: 48 });
    expect(card.getByText(name).props.numberOfLines).toBeUndefined();
  }
});

// A failing test must not leave its fake clock to the next ones.
afterEach(() => jest.useRealTimers());

it("dates the income sample short, as iOS and the web: « 21 nov. »", async () => {
  jest.useFakeTimers({ now: new Date(2026, 10, 21) });
  const view = await renderSheet().view;

  expect(view.getByTestId("reconcile-reason-income")).toHaveTextContent(
    /incomeSample:21 nov\..*\+6’000\.00 CHF/,
  );
});

it("hands each answer back to the step", async () => {
  const { onChoose, view: pending } = renderSheet({
    hasOwe: true,
    partlySpent: null,
  });
  const view = await pending;
  expect(view.queryByTestId("reconcile-reason-card")).toBeNull();

  await fireEvent.press(
    view.getByText("home.reconcile.compare.noteIncome:6’000.00 CHF"),
  );
  await fireEvent.press(
    view.getByText("home.reconcile.reasons.reviewAccounts"),
  );
  await fireEvent.press(view.getByText("home.reconcile.compare.leaveAsIs"));
  expect(onChoose.mock.calls).toEqual([
    ["noteIncome"],
    ["reviewAccounts"],
    ["leave"],
  ]);
});

it("masks the amounts, the line's name and its bar, the samples kept", async () => {
  mockAmountsHidden = true;
  const view = await renderSheet().view;

  expect(view.queryByText(/Courses/)).toBeNull();
  expect(
    view.queryByTestId("reconcile-reasons-bar", {
      includeHiddenElements: true,
    }),
  ).toBeNull();
  expect(view.getByText("home.reconcile.reasons.title:•••")).toBeTruthy();
  expect(view.getByTestId("reconcile-reason-card")).toHaveTextContent(
    /350\.00/,
  );
  expect(view.queryByText(/6’000|200\.00|400\.00|600\.00/)).toBeNull();
});
