import { i18n, translate } from "@/core/i18n/i18n";
import { useAmountVisibility } from "@/core/ui/amount-visibility";

import {
  scrubDayAt,
  scrubEyebrow,
  scrubFigure,
  scrubReading,
} from "./balance-scrub";
import type { TrendedTrajectory } from "./current-month-view-model";

const trajectory: TrendedTrajectory = {
  landing: [],
  real: [
    { day: 0, balance: 1000 },
    { day: 1, balance: 900 },
    { day: 2, balance: 800 },
  ],
  plannedAvailable: 1000,
  driftDate: null,
  plannedOutflows: 500,
  today: 2,
  totalDays: 30,
  plannedBalance: 400,
  estimatedBalance: 800,
  drift: 400,
  trend: 600,
};
const start = new Date(2026, 6, 25);

describe("scrubReading", () => {
  it("reads the real stroke and the plan's diagonal on a lived day", () => {
    const reading = scrubReading(1, trajectory, start);

    // Plan falls 600 over 30 days: 1000 - 20.
    expect(reading).toMatchObject({ real: 900, plan: 980, estimate: null });
    expect(reading.date).toEqual(new Date(2026, 6, 25));
  });

  it("interpolates the estimate on the projection after today", () => {
    const reading = scrubReading(16, trajectory, start);

    // Projection runs (2, 800) to (30, 600): 14 of 28 days in.
    expect(reading).toMatchObject({ real: null, estimate: 700, plan: 680 });
  });

  it("rounds a negative half centime away from zero, like iOS", () => {
    const overdrawn = {
      ...trajectory,
      real: [{ day: 2, balance: 0 }],
      totalDays: 4,
      trend: -0.25,
    };

    // Halfway between 0 and -0.25: -0.125, which `Math.round` alone sends to -0.12.
    expect(scrubReading(3, overdrawn, start).estimate).toBe(-0.13);
  });

  it("reads no estimate when there is nothing left to project", () => {
    const reading = scrubReading(30, { ...trajectory, today: 30 }, start);

    expect(reading.estimate).toBeNull();
  });

  it("clamps outside the period", () => {
    expect(scrubReading(-3, trajectory, start).day).toBe(0);
    expect(scrubReading(99, trajectory, start).day).toBe(30);
  });

  it("dates day 0 and day 1 as the first day", () => {
    expect(scrubReading(0, trajectory, start).date).toEqual(start);
  });
});

describe("scrubFigure", () => {
  it("prefers the real reading, then the estimate, then the plan", () => {
    const base = { day: 1, date: start, plan: 3 };

    expect(scrubFigure({ ...base, real: 1, estimate: 2 })).toBe(1);
    expect(scrubFigure({ ...base, real: null, estimate: 2 })).toBe(2);
    expect(scrubFigure({ ...base, real: null, estimate: null })).toBe(3);
  });
});

describe("scrubEyebrow", () => {
  const eyebrow = (day: number, hidden: boolean) =>
    scrubEyebrow(
      translate,
      "fr",
      scrubReading(day, trajectory, start),
      "CHF",
      hidden,
    );

  beforeEach(() => {
    i18n.locale = "fr";
    useAmountVisibility.setState({ areAmountsHidden: false });
  });

  it("names the real stroke with the plan, or without it when hidden", () => {
    expect(eyebrow(1, false)).toMatch(/^Réel le 25 juillet · Prévu 980 CHF$/);
    expect(eyebrow(1, true)).toBe("Réel le 25 juillet");
  });

  it("names the estimate once the day is still to come", () => {
    expect(eyebrow(16, false)).toMatch(/^Estimé le 9 août · Prévu 680 CHF$/);
    expect(eyebrow(16, true)).toBe("Estimé le 9 août");
  });
});

describe("scrubDayAt", () => {
  it("maps x onto the period", () => {
    expect(scrubDayAt(50, 100, 30)).toBe(15);
    expect(scrubDayAt(10, 0, 30)).toBe(0);
  });

  it("clamps a finger dragged past the plot", () => {
    expect(scrubDayAt(130, 100, 30)).toBe(30);
    expect(scrubDayAt(-20, 100, 30)).toBe(0);
  });
});
