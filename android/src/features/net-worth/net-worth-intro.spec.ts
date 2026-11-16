import {
  countAt,
  INTRO_SAMPLE,
  introTotals,
  primaryAction,
} from "./net-worth-intro";

describe("net-worth intro content", () => {
  it("derives the three figures of the story from the sample lines", () => {
    expect(introTotals(INTRO_SAMPLE)).toEqual({
      gross: 32200,
      netBefore: 26200,
      netAfter: 26700,
    });
  });

  it.each([
    [0, true, "next"],
    [1, false, "next"],
    [2, false, "done"],
    [2, true, "add"],
  ] as const)("step %i, empty %s → %s", (step, isEmpty, expected) => {
    expect(primaryAction(step, isEmpty)).toBe(expected);
  });

  it("rolls from the start to the end, eased out, and clamps outside 0…1", () => {
    expect(countAt(0, 32200, 0)).toBe(0);
    expect(countAt(0, 32200, 0.5)).toBe(28175);
    expect(countAt(0, 32200, 1)).toBe(32200);
    expect(countAt(32200, 26200, 2)).toBe(26200);
  });
});
