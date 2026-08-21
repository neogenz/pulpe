import type { BudgetSparse } from "pulpe-shared";

import { tabLabel } from "./month-pager";

function budget(month: number, year: number): BudgetSparse {
  return { id: `${year}-${month}`, month, year } as BudgetSparse;
}

describe("tabLabel", () => {
  it("names the month alone inside the year being looked at", () => {
    expect(tabLabel(budget(5, 2026), 2026)).toBe("mai");
  });

  it("adds the year to a month from another one", () => {
    expect(tabLabel(budget(12, 2025), 2026)).toBe("décembre 2025");
  });

  it("re-anchors when the selected month crosses into the next year", () => {
    // The rail spans a new year: with January selected, it is December that
    // now needs the suffix — the reverse of the case above, same two budgets.
    expect(tabLabel(budget(1, 2026), 2026)).toBe("janvier");
    expect(tabLabel(budget(12, 2025), 2026)).toBe("décembre 2025");
  });

  it("names months in the active locale", () => {
    expect(tabLabel(budget(5, 2026), 2026, "de")).toBe("Mai");
  });
});
