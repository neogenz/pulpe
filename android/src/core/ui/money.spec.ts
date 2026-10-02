import { exceedsCents, parseAmount, seedAmountText } from "./money";

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

describe("exceedsCents", () => {
  it.each(["12", "12.", "12,5", "12.50", "1'500,05"])(
    "lets %s through",
    (input) => {
      expect(exceedsCents(input)).toBe(false);
    },
  );

  it.each(["12.345", "12,505", "0.001"])("refuses %s", (input) => {
    expect(exceedsCents(input)).toBe(true);
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
