import {
  DEFAULT_SPREAD_LENGTH,
  MAX_SPREAD_MONTHS,
  periodKey,
  selectedPeriods,
  spreadCounterpart,
  spreadTranches,
  spreadWindow,
  spreadWindowProblem,
} from "./spread-window";

const ANCHOR = { year: 2026, month: 11 };

describe("spreadWindow", () => {
  it("walks forward from the anchor", () => {
    const cells = spreadWindow(ANCHOR, DEFAULT_SPREAD_LENGTH, []);

    expect(cells.map(periodKey)).toEqual(["2026-11", "2026-12", "2027-1"]);
  });

  it("marks the months the user took out", () => {
    const cells = spreadWindow(ANCHOR, 3, ["2026-12"]);

    expect(cells.map((cell) => cell.isSelected)).toEqual([true, false, true]);
    expect(selectedPeriods(cells)).toEqual([
      { year: 2026, month: 11 },
      { year: 2027, month: 1 },
    ]);
  });
});

describe("spreadTranches", () => {
  // The preview must be the same arithmetic the server persists, or the user
  // reads one set of amounts and gets another.
  it("divides a total to the centime", () => {
    const tranches = spreadTranches("total", 1000, 3);

    expect(tranches.reduce((sum, part) => sum + part, 0)).toBeCloseTo(1000, 10);
    expect(tranches[0]).toBeGreaterThanOrEqual(tranches[2]);
  });

  it("replicates a monthly amount untouched", () => {
    expect(spreadTranches("perMonth", 250, 4)).toEqual([250, 250, 250, 250]);
  });

  it("has nothing to show without an amount", () => {
    expect(spreadTranches("total", 0, 3)).toEqual([]);
  });
});

describe("spreadCounterpart", () => {
  it("shows the total behind a monthly amount", () => {
    expect(spreadCounterpart("perMonth", 250, 4)).toBe(1000);
  });

  it("shows the first month's share behind a total", () => {
    expect(spreadCounterpart("total", 1000, 3)).toBe(
      spreadTranches("total", 1000, 3)[0],
    );
  });
});

describe("spreadWindowProblem", () => {
  it("accepts a window with enough months", () => {
    expect(spreadWindowProblem(spreadWindow(ANCHOR, 3, []), 2)).toBeNull();
  });

  it("refuses a window emptied below the minimum", () => {
    const cells = spreadWindow(ANCHOR, 3, ["2026-12", "2027-1"]);

    expect(spreadWindowProblem(cells, 2)).toEqual({ kind: "min", count: 2 });
  });

  it("refuses more months than the backend takes", () => {
    const cells = spreadWindow(ANCHOR, MAX_SPREAD_MONTHS + 1, []);

    expect(spreadWindowProblem(cells, 1)).toEqual({ kind: "max", count: 36 });
  });
});
