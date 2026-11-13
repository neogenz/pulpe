import { render } from "@testing-library/react-native";
import type { SavingsGoalProgress } from "pulpe-shared";

import { GoalProgressCard } from "./goal-progress-card";

jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({
    locale: "fr",
    t: (key: string, options?: Record<string, unknown>) =>
      options === undefined ? key : `${key} ${JSON.stringify(options)}`,
  }),
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
  months: [],
  originalTargetAmount: null,
  originalCurrency: null,
  targetCurrency: null,
  exchangeRate: null,
};

it("says the percent and what is left on the bar", async () => {
  const view = await render(
    <GoalProgressCard progress={progress} status="ACTIVE" currency="CHF" />,
  );

  expect(view.getByText("25 %")).toBeTruthy();
  expect(view.getByText(/goals\.hero\.left/)).toBeTruthy();
  expect(view.getByText(/goals\.hero\.captionTarget/)).toBeTruthy();
});
