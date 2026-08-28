import { budgetTiming } from "./budget-list-selectors";

const AUGUST_2026 = { year: 2026, month: 8 };

describe("budgetTiming", () => {
  it("names the month being lived in", () => {
    expect(budgetTiming({ year: 2026, month: 8 }, AUGUST_2026)).toBe("current");
  });

  it("reads an earlier month in the same year as past", () => {
    expect(budgetTiming({ year: 2026, month: 7 }, AUGUST_2026)).toBe("past");
  });

  it("reads a later month in the same year as future", () => {
    expect(budgetTiming({ year: 2026, month: 9 }, AUGUST_2026)).toBe("future");
  });

  it("crosses the year boundary in both directions", () => {
    // December of last year is past even though 12 > 8, and January of next
    // year is future even though 1 < 8 — the month alone cannot answer this.
    expect(budgetTiming({ year: 2025, month: 12 }, AUGUST_2026)).toBe("past");
    expect(budgetTiming({ year: 2027, month: 1 }, AUGUST_2026)).toBe("future");
  });

  it("treats a budget with no period as the current one", () => {
    // The sparse fieldset makes both fields optional; dimming a row we cannot
    // place would be a guess presented as a fact.
    expect(budgetTiming({}, AUGUST_2026)).toBe("current");
  });
});
