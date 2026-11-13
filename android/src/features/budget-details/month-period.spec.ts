import { periodProgress, upcomingReportMonth } from "./month-period";

describe("periodProgress", () => {
  it("counts the day while the period runs", () => {
    // November on a 25th pay day runs 25 Oct → 24 Nov, 31 days.
    const progress = periodProgress(11, 2026, 25, new Date(2026, 9, 25));

    expect(progress.day).toEqual({ current: 1, count: 31 });
    expect(progress.startsIn).toBeNull();
    expect(periodProgress(11, 2026, 25, new Date(2026, 10, 3)).day).toEqual({
      current: 10,
      count: 31,
    });
  });

  it("counts the days before it starts", () => {
    const progress = periodProgress(12, 2026, null, new Date(2026, 10, 28));

    expect(progress.startsIn).toBe(3);
    expect(progress.day).toBeNull();
    expect(upcomingReportMonth(12, progress)).toBe(11);
  });

  it("has neither once the period is over", () => {
    const progress = periodProgress(10, 2026, null, new Date(2026, 10, 3));

    expect(progress.day).toBeNull();
    expect(upcomingReportMonth(10, progress)).toBeNull();
  });
});
