import { savingsGoalCreateSchema } from "pulpe-shared";

import { boundsBetween } from "./goal-draft";

/**
 * The server reads its own clock: UTC for "not in the past", and the month it
 * is in for the 120-month horizon. These are the two moments a phone's own
 * calendar disagrees with it.
 */
afterEach(() => jest.useRealTimers());

it("ahead of UTC just after midnight on the 1st, ends the horizon on the server's month", () => {
  // 00:30 on October 1st in Zurich, still September 30th in UTC.
  const { earliest, latest } = boundsBetween(
    null,
    { year: 2026, month: 10, day: 1 },
    { year: 2026, month: 9, day: 30 },
  );

  expect(earliest).toBe("2026-10-01");
  // Counted from September, as the server counts it: from October, the last
  // month offered was one the server refuses.
  expect(latest).toBe("2036-08-31");
});

it("behind UTC in the evening, starts on the server's today", () => {
  // 21:00 on October 1st in New York, already October 2nd in UTC.
  jest.useFakeTimers({ now: new Date("2026-10-02T01:00:00.000Z") });
  const { earliest } = boundsBetween(
    null,
    { year: 2026, month: 10, day: 1 },
    { year: 2026, month: 10, day: 2 },
  );
  const accepts = (targetDate: string) =>
    savingsGoalCreateSchema.safeParse({ name: "Voyage", targetDate }).success;

  expect(earliest).toBe("2026-10-02");
  expect(accepts(earliest)).toBe(true);
  // The phone's own today, which the picker used to offer.
  expect(accepts("2026-10-01")).toBe(false);
});

it("keeps every other day of the year exactly as before", () => {
  const sameDay = { year: 2026, month: 10, day: 1 };

  expect(boundsBetween(null, sameDay, sameDay)).toEqual({
    earliest: "2026-10-01",
    latest: "2036-09-30",
  });
});
