import { convertTypedAmount } from "./currency-converter";

describe("convertTypedAmount", () => {
  it("multiplies by the rate and accepts a decimal comma", () => {
    expect(convertTypedAmount("100", 1.05)).toBeCloseTo(105);
    expect(convertTypedAmount("10,5", 2)).toBe(21);
  });

  it("shows nothing without a rate or a number", () => {
    expect(convertTypedAmount("100", undefined)).toBeNull();
    expect(convertTypedAmount("", 1.05)).toBeNull();
    expect(convertTypedAmount("abc", 1.05)).toBeNull();
  });
});
