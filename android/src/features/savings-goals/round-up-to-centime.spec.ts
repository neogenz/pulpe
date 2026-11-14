import { roundUpToCentime } from "./round-up-to-centime";

describe("roundUpToCentime", () => {
  it.each([
    [1.1, 1.1],
    [33.34, 33.34],
    [0.07, 0.07],
    [33.341, 33.35],
    [0, 0],
  ])("rounds %p up to %p", (amount, expected) => {
    expect(roundUpToCentime(amount)).toBe(expected);
  });
});
