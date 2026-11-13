jest.mock("./analytics", () => ({ getAnalyticsClient: () => null }));

import { isFlagEnabled } from "./feature-flags";

describe("isFlagEnabled", () => {
  it("is on only for a boolean true", () => {
    expect(isFlagEnabled(true)).toBe(true);
    expect(isFlagEnabled(false)).toBe(false);
    expect(isFlagEnabled(undefined)).toBe(false);
    expect(isFlagEnabled("variant-a")).toBe(false);
  });
});
