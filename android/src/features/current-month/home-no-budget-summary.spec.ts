import type { TemplateLine } from "pulpe-shared";

import { noBudgetSummary } from "./home-no-budget-summary";

const line = (kind: TemplateLine["kind"], amount: number) =>
  ({ kind, amount }) as TemplateLine;

describe("noBudgetSummary", () => {
  it("splits what goes out between expenses and savings", () => {
    expect(
      noBudgetSummary([
        line("income", 3000),
        line("expense", 1200),
        line("saving", 300),
      ]),
    ).toEqual({ income: 3000, expenses: 1200, savings: 300, available: 1500 });
  });
});
