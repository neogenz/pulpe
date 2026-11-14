import type { BalanceTrajectory } from "pulpe-shared";

import { scrubDayAt, scrubReading } from "./balance-scrub";

const trajectory: BalanceTrajectory = {
  landing: [
    { day: 0, balance: 1000 },
    { day: 1, balance: 900 },
    { day: 2, balance: 800 },
  ],
  real: [],
  plannedAvailable: 1000,
  driftDate: null,
  plannedOutflows: 500,
  today: 2,
  totalDays: 30,
  plannedBalance: 1000,
  estimatedBalance: 800,
  drift: -200,
};
const start = new Date(2026, 6, 25);

describe("scrubReading", () => {
  it("reads the landing line up to today and dates day 1 as the first day", () => {
    const reading = scrubReading(1, trajectory, start);
    expect(reading).toMatchObject({ estimate: 900, plan: 1000, isPast: true });
    expect(reading.date).toEqual(new Date(2026, 6, 25));
  });

  it("holds the forecast past today and clamps outside the period", () => {
    const reading = scrubReading(99, trajectory, start);
    expect(reading).toMatchObject({ day: 30, estimate: 800, isPast: false });
    expect(scrubReading(-3, trajectory, start).day).toBe(0);
  });
});

describe("scrubDayAt", () => {
  it("maps x onto the period", () => {
    expect(scrubDayAt(50, 100, 30)).toBe(15);
    expect(scrubDayAt(10, 0, 30)).toBe(0);
  });
});
