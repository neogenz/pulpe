import { renderHook } from "@testing-library/react-native";

import { ENV } from "@/core/config/env";

import { isFlagEnabled, useFeatureFlag } from "./feature-flags";

jest.mock("./analytics-client", () => ({ getAnalyticsClient: () => null }));
jest.mock("@/core/config/env", () => ({
  ENV: { devFeatureFlags: [] as string[] },
}));

describe("isFlagEnabled", () => {
  it("is on only for a boolean true", () => {
    expect(isFlagEnabled(true)).toBe(true);
    expect(isFlagEnabled(false)).toBe(false);
    expect(isFlagEnabled(undefined)).toBe(false);
    expect(isFlagEnabled("variant-a")).toBe(false);
  });
});

describe("useFeatureFlag", () => {
  afterEach(() => {
    (ENV.devFeatureFlags as string[]).length = 0;
  });

  it("is off without PostHog", async () => {
    const { result } = await renderHook(() => useFeatureFlag("net_worth"));
    expect(result.current).toBe(false);
  });

  it("is on for a key the local build forces, and only for it", async () => {
    (ENV.devFeatureFlags as string[]).push("net_worth");

    const forced = await renderHook(() => useFeatureFlag("net_worth"));
    const other = await renderHook(() => useFeatureFlag("other"));
    expect(forced.result.current).toBe(true);
    expect(other.result.current).toBe(false);
  });
});
