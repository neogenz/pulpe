import { parseAmount, seedAmountText } from "./money";

describe("parseAmount", () => {
  it.each([
    ["1500", 1500],
    ["1500.50", 1500.5],
    // The French keyboard hands back a comma; the store only knows dots.
    ["1500,50", 1500.5],
    ["1 500", 1500],
    ["1'500", 1500],
    // Half-typed decimals read as the whole part rather than as nothing.
    ["12,", 12],
  ])("reads %s as %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "   ", "abc"])("reads %s as no amount", (input) => {
    expect(parseAmount(input)).toBeNull();
  });
});

describe("seedAmountText", () => {
  it("leaves an unanswered field empty rather than showing a zero", () => {
    expect(seedAmountText(null)).toBe("");
  });

  it("seeds an existing amount so an edit starts from it", () => {
    expect(seedAmountText(1500.5)).toBe("1500.5");
  });
});
