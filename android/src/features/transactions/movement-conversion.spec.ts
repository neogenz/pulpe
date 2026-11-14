import { convertMovementAmount, withConversion } from "./movement-conversion";

describe("convertMovementAmount", () => {
  it("should book the converted amount rounded to cents and keep the rate as quoted", () => {
    expect(convertMovementAmount(10, "EUR", "CHF", 0.93456)).toEqual({
      amount: 9.35,
      originalAmount: 10,
      originalCurrency: "EUR",
      targetCurrency: "CHF",
      exchangeRate: 0.93456,
    });
  });

  it.each([
    ["no amount", null, "EUR", 0.9],
    ["a zero amount", 0, "EUR", 0.9],
    ["the display currency", 10, "CHF", 0.9],
    ["no rate yet", 10, "EUR", undefined],
  ] as const)("should not convert with %s", (_name, amount, from, rate) => {
    expect(convertMovementAmount(amount, from, "CHF", rate)).toBeNull();
  });
});

describe("withConversion", () => {
  const payload = {
    budgetId: "b",
    name: "Café",
    amount: 10,
    kind: "expense" as const,
  };

  it("should leave a same-currency payload untouched", () => {
    expect(withConversion(payload, null)).toBe(payload);
  });

  it("should replace the amount and add the foreign leg", () => {
    const conversion = convertMovementAmount(10, "EUR", "CHF", 0.9);
    expect(withConversion(payload, conversion)).toMatchObject({
      amount: 9,
      originalAmount: 10,
      originalCurrency: "EUR",
      targetCurrency: "CHF",
      exchangeRate: 0.9,
    });
  });
});
