import { parseDeepLink } from "./deep-links";

describe("parseDeepLink", () => {
  it("should read the widget's query-string form", () => {
    expect(parseDeepLink("pulpe://budget?id=abc-123")).toEqual({
      kind: "budget",
      budgetId: "abc-123",
    });
  });

  it("should read the path form Expo Router would resolve on its own", () => {
    expect(parseDeepLink("pulpe:///budget?id=abc-123")).toEqual({
      kind: "budget",
      budgetId: "abc-123",
    });
  });

  it("should accept add-expense with or without a budget", () => {
    expect(parseDeepLink("pulpe://add-expense")).toEqual({
      kind: "add-expense",
    });
    expect(parseDeepLink("pulpe://add-expense?budgetId=abc-123")).toEqual({
      kind: "add-expense",
    });
  });

  it("should refuse a budget link that names no budget", () => {
    // Better nothing than a detail screen asking the API for `undefined`.
    expect(parseDeepLink("pulpe://budget")).toBeNull();
    expect(parseDeepLink("pulpe://budget?id=")).toBeNull();
  });

  it("should leave the URLs other screens own alone", () => {
    expect(
      parseDeepLink("https://app.pulpe.app/reset-password#access_token=x"),
    ).toBeNull();
    expect(parseDeepLink("pulpe://settings")).toBeNull();
  });
});
