import { readFileSync, sourceFiles } from "@/core/testing/source-files";

import { sanitizeProperties } from "./analytics-properties";

describe("event properties", () => {
  it("drops every key that names money", () => {
    expect(
      sanitizeProperties({
        step: "income",
        amount: 4200,
        monthly_income: 6500,
        ending_balance: 120,
        available_to_spend: 300,
        total: 12,
        rollover: 1,
      }),
    ).toEqual({ step: "income" });
  });

  it("keeps a count, which says how many and never how much", () => {
    expect(
      sanitizeProperties({ charges_count: 4, custom_transactions_count: 2 }),
    ).toEqual({ charges_count: 4, custom_transactions_count: 2 });
  });

  it("drops secrets wherever the word sits in the key", () => {
    expect(
      sanitizeProperties({
        source: "draft",
        access_token_expires_in_seconds: 3600,
        recovery_key: "x",
        pin_code: "1234",
        user_password_hint: "y",
      }),
    ).toEqual({ source: "draft" });
  });

  it("drops the keys that carry whatever the user typed", () => {
    expect(
      sanitizeProperties({
        step: "charges",
        name: "Loyer",
        label: "Loyer",
        description: "Loyer",
        message: "boom",
      }),
    ).toEqual({ step: "charges" });
  });

  it("leaves the dimensions a funnel is read by", () => {
    const properties = {
      step: "budget_preview",
      step_index: 6,
      step_count: 6,
      auth_method: "google",
      was_authenticated: true,
    };

    expect(sanitizeProperties(properties)).toEqual(properties);
  });
});

/**
 * Every event has to pass through `captureEvent`, which is where the filter
 * above runs and where the name is narrowed to the shared catalogue. A second
 * caller reaching the SDK directly would send an unfiltered payload under a
 * name no dashboard knows.
 */
describe("the single exit", () => {
  it("keeps the PostHog client out of every file but its own", () => {
    const holders = sourceFiles("src").filter((path) => {
      if (path.endsWith("core/observability/analytics.ts")) return false;
      return /from "posthog-react-native"/.test(readFileSync(path, "utf8"));
    });

    expect(holders).toEqual([]);
  });
});
