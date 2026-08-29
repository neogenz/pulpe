import { fireEvent, render } from "@testing-library/react-native";
import type { BalanceTrajectory } from "pulpe-shared";

import { todayCaptionLeft } from "../balance-chart-scale";
import { BalanceTrajectoryChart } from "./balance-trajectory-chart";

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
jest.mock("@/core/i18n/locale-store", () => ({
  useTranslation: () => ({ locale: "fr", t: (key: string) => key }),
}));

function trajectory(today: number): BalanceTrajectory {
  return {
    landing: [{ day: 0, balance: 500 }],
    real: [{ day: 0, balance: 500 }],
    plannedAvailable: 500,
    driftDate: null,
    plannedOutflows: 400,
    today,
    totalDays: 30,
    plannedBalance: 500,
    estimatedBalance: 500,
    drift: 0,
  };
}

const period = {
  startDate: new Date(2026, 6, 25),
  endDate: new Date(2026, 7, 24),
};

function layout(width: number) {
  return { nativeEvent: { layout: { x: 0, y: 0, width, height: 16 } } };
}

async function renderMeasured(today: number) {
  const view = await render(
    <BalanceTrajectoryChart
      trajectory={trajectory(today)}
      period={period}
      accent="green"
      ruleColor="gray"
    />,
  );
  const todayCaption = view.getByTestId("chart-caption-today");
  await fireEvent(todayCaption.parent as never, "layout", layout(300));
  await fireEvent(view.getByText("25 juillet"), "layout", layout(60));
  await fireEvent(todayCaption, "layout", layout(70));
  await fireEvent(view.getByText("24 août"), "layout", layout(50));
  return view;
}

it("prints the period's first and last day and today under the plot", async () => {
  const view = await renderMeasured(15);

  expect(view.getByText("25 juillet")).toBeTruthy();
  expect(view.getByText("24 août")).toBeTruthy();
  expect(view.getByText("home.hero.chart.today")).toBeTruthy();
  // Centred on the marker: half the row minus half the caption.
  expect(view.getByTestId("chart-caption-today")).toHaveStyle({ left: 115 });
});

it("keeps the today caption clear of the start date on the first day", async () => {
  const view = await renderMeasured(0);

  expect(view.getByTestId("chart-caption-today")).toHaveStyle({ left: 68 });
});

describe("todayCaptionLeft", () => {
  const widths = { row: 300, start: 60, today: 70, end: 50 };

  it("centres on the marker when there is room", () => {
    expect(todayCaptionLeft(widths, 0.5, 8)).toBe(115);
  });

  it("stops at the end date on the last day", () => {
    expect(todayCaptionLeft(widths, 1, 8)).toBe(172);
  });

  it("sits beside the start date when the row cannot hold all three", () => {
    expect(todayCaptionLeft({ ...widths, row: 120 }, 0.5, 8)).toBe(68);
  });
});
