import { act, render } from "@testing-library/react-native";

import { useAmountVisibility } from "@/core/ui/amount-visibility";
import { hapticSelection } from "@/core/ui/haptics";

import { HomeHeroCard } from "./home-hero-card";

let onScrub: (day: number | null) => void;

jest.mock("./balance-trajectory-chart", () => ({
  BalanceTrajectoryChart: (props: { onScrub: typeof onScrub }) => {
    onScrub = props.onScrub;
    return null;
  },
}));
jest.mock("@/core/ui/haptics", () => ({
  hapticCommit: jest.fn(),
  hapticSelection: jest.fn(),
}));
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string) => key,
  }),
}));

const trajectory = {
  landing: [],
  real: [
    { day: 0, balance: 1000 },
    { day: 10, balance: 700 },
  ],
  plannedAvailable: 1000,
  driftDate: null,
  plannedOutflows: 800,
  today: 12,
  totalDays: 31,
  plannedBalance: 1000,
  estimatedBalance: 1240.5,
  drift: 240.5,
  trend: 1100,
};

it("swaps figure and eyebrow to the scrubbed day, ticking once per day crossed and on release", async () => {
  useAmountVisibility.setState({ areAmountsHidden: false });
  const view = await render(
    <HomeHeroCard
      presentation={{
        plannedBalance: 1000,
        estimatedBalance: 1240.5,
        variance: 240.5,
        verdict: "gain",
        tone: "favorable",
        driftDate: null,
      }}
      trajectory={trajectory}
      period={{
        startDate: new Date(2026, 6, 25),
        endDate: new Date(2026, 7, 24),
      }}
      currency="CHF"
      onPressCalculation={jest.fn()}
    />,
  );
  expect(view.getByText("home.hero.eyebrow")).toBeTruthy();
  expect(view.getByText(/1.?240\.50/)).toBeTruthy();

  await act(() => onScrub(10));
  expect(view.queryByText("home.hero.eyebrow")).toBeNull();
  expect(view.getByText("home.hero.scrub.realWithPlan")).toBeTruthy();
  expect(view.getByText(/700/)).toBeTruthy();
  expect(hapticSelection).toHaveBeenCalledTimes(1);

  await act(() => onScrub(10));
  expect(hapticSelection).toHaveBeenCalledTimes(1);

  await act(() => onScrub(null));
  expect(view.getByText("home.hero.eyebrow")).toBeTruthy();
  expect(view.getByText(/1.?240\.50/)).toBeTruthy();
  expect(hapticSelection).toHaveBeenCalledTimes(2);
});
