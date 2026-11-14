import { fireEvent, render } from "@testing-library/react-native";

import { useAmountVisibility } from "@/core/ui/amount-visibility";

import type { HeroPresentation } from "../home-hero-presentation";
import { HomeHeroCard } from "./home-hero-card";

jest.mock("@shopify/react-native-skia", () => ({
  Circle: () => null,
  DashPathEffect: () => null,
  Line: () => null,
  vec: jest.fn(),
}));
jest.mock("victory-native", () => ({
  CartesianChart: () => null,
  Line: () => null,
}));
jest.mock("@/core/ui/haptics", () => ({ hapticCommit: jest.fn() }));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, params?: Record<string, unknown>) =>
      params === undefined ? key : `${key}:${JSON.stringify(params)}`,
  }),
}));

const presentation: HeroPresentation = {
  plannedBalance: 1000,
  estimatedBalance: 1240.5,
  variance: 240.5,
  verdict: "gain",
  tone: "favorable",
  driftDate: null,
};

const trajectory = {
  landing: [{ day: 0, balance: 1000 }],
  real: [{ day: 0, balance: 1000 }],
  plannedAvailable: 1000,
  driftDate: null,
  plannedOutflows: 800,
  today: 12,
  totalDays: 31,
  plannedBalance: 1000,
  estimatedBalance: 1240.5,
  drift: 240.5,
};

const period = {
  startDate: new Date(2026, 6, 25),
  endDate: new Date(2026, 7, 24),
};

function renderHero(props: Partial<React.ComponentProps<typeof HomeHeroCard>>) {
  return render(
    <HomeHeroCard
      presentation={presentation}
      trajectory={trajectory}
      period={period}
      currency="CHF"
      onPressCalculation={jest.fn()}
      {...props}
    />,
  );
}

beforeEach(() => useAmountVisibility.setState({ areAmountsHidden: false }));

it("shows the estimate, the verdict and the three chart captions", async () => {
  const onPressCalculation = jest.fn();
  const view = await renderHero({ onPressCalculation });

  // Whole digits on the hero; the thousands separator is the locale's.
  expect(view.getByText(/1.?241/)).toBeTruthy();
  expect(view.getByText("home.hero.eyebrow")).toBeTruthy();
  expect(view.getByText("home.hero.verdict.gain")).toBeTruthy();
  expect(view.getByText("25 juillet")).toBeTruthy();
  expect(view.getByText("home.hero.chart.today")).toBeTruthy();
  expect(view.getByText("24 août")).toBeTruthy();

  await fireEvent.press(view.getByText("home.hero.calculation"));
  expect(onPressCalculation).toHaveBeenCalledTimes(1);
});

it("hides and shows the amounts from the eye beside the eyebrow", async () => {
  const view = await renderHero({});

  await fireEvent.press(view.getByLabelText("home.hero.hideAmounts"));
  expect(useAmountVisibility.getState().areAmountsHidden).toBe(true);
  expect(view.getByLabelText("home.hero.showAmounts")).toBeTruthy();
});

it("invites instead of judging on the first month, with no plot", async () => {
  const view = await renderHero({ startsFresh: true });

  expect(
    view.getByText("home.hero.fresh.verdict home.hero.fresh.tail"),
  ).toBeTruthy();
  expect(view.queryByText("home.hero.chart.today")).toBeNull();
});

it("keeps the captions while the amounts are masked", async () => {
  useAmountVisibility.setState({ areAmountsHidden: true });
  const view = await renderHero({});

  expect(view.queryByText(/1.?241/)).toBeNull();
  expect(view.getByText("25 juillet")).toBeTruthy();
  expect(view.getByText("home.hero.chart.today")).toBeTruthy();
});
