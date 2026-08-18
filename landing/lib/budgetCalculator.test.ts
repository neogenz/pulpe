import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney } from "./amount";
import {
  availableToSpend,
  committedExpenses,
  type BudgetInputs,
} from "./budgetCalculator";

describe("budget calculator", () => {
  it("matches the onboarding formula for the documented example", () => {
    const input: BudgetInputs = {
      income: 5000,
      rent: 2000,
      insurance: 400,
      phone: 0,
      internet: 0,
      transport: 0,
      leasing: 0,
      extra: 0,
      savings: 500,
    };

    assert.equal(committedExpenses(input), 2900);
    assert.equal(availableToSpend(input), 2100);
    assert.equal(formatMoney(2100, "CHF"), "2’100 CHF");
  });

  it("keeps a deficit usable instead of blocking", () => {
    const input: BudgetInputs = {
      income: 1000,
      rent: 2000,
      insurance: 0,
      phone: 0,
      internet: 0,
      transport: 0,
      leasing: 0,
      extra: 0,
      savings: 0,
    };

    assert.equal(availableToSpend(input), -1000);
  });
});
