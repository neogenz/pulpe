import {
  GUIDE_SAMPLE,
  GUIDE_SCENES,
  guideAction,
  guideGap,
} from "./reconcile-guide";

describe("reconcile guide content", () => {
  it("lists the three scenes in order", () => {
    expect(GUIDE_SCENES).toEqual(["compare", "type", "check"]);
  });

  it("shows a gap that the one sample expense closes exactly", () => {
    expect(guideGap(GUIDE_SAMPLE)).toBe(GUIDE_SAMPLE.expense);
    expect(GUIDE_SAMPLE.pulpe - GUIDE_SAMPLE.expense).toBe(GUIDE_SAMPLE.bank);
  });

  it.each([
    [0, "next"],
    [1, "next"],
    [2, "start"],
  ] as const)("scene %i → %s", (index, expected) => {
    expect(guideAction(index)).toBe(expected);
  });
});
