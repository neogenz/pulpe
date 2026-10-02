import { render } from "@testing-library/react-native";
import type { SavingsGoalProgress } from "pulpe-shared";
import { useColorScheme } from "react-native";

import { HERO_COLORS } from "@/core/ui/theme";

import { GoalProgressCard } from "./goal-progress-card";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));

const progress: SavingsGoalProgress = {
  goalId: "2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
  status: "ACTIVE",
  startDate: null,
  targetAmount: 1000,
  targetDate: "2026-11-30",
  plannedCumulative: 500,
  plannedProjection: 1000,
  confirmed: 250,
  achievementPercent: 25,
  monthsElapsed: 2,
  monthsRemaining: 2,
  isOverdue: false,
  pace: 250,
  confirmedPace: 125,
  required: 375,
  projected: 750,
  paceStatus: "behind",
  suggestCompletion: false,
  linkedLineCount: 4,
  cumulativeGap: 250,
  estimatedCompletion: null,
  initialAmount: 0,
  months: [
    {
      month: 9,
      year: 2026,
      state: "past",
      isLocked: true,
      isContributionEligible: true,
      plannedAmount: 250,
      confirmedAmount: 125,
      plannedCumulative: 250,
      confirmedCumulative: 125,
      lines: [],
    },
  ],
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
};

afterEach(() => jest.restoreAllMocks());

it.each(["light", "dark"] as const)(
  "keeps a behind goal's verdict neutral in the %s scheme",
  async (scheme) => {
    jest.mocked(useColorScheme).mockReturnValue(scheme);
    const view = await render(
      <GoalProgressCard progress={progress} currency="CHF" period={null} />,
    );

    expect(view.getByText("goals.progress.pace.behind")).toHaveStyle({
      color: HERO_COLORS[scheme].ink,
    });
  },
);
