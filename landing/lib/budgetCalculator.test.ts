import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatMoney } from "./amount";
import {
  CALCULATOR_CHIPS,
  EMPTY_BUDGET,
  availableToSpend,
  chipLabel,
  committedExpenses,
  toggleChip,
  updateLineAmount,
  type BudgetInputs,
} from "./budgetCalculator";

const groceries = CALCULATOR_CHIPS[0];
const saving = CALCULATOR_CHIPS[3];
const pillar = CALCULATOR_CHIPS[4];

describe("budget calculator", () => {
  it("matches the onboarding formula for the documented example", () => {
    const input: BudgetInputs = {
      ...EMPTY_BUDGET,
      income: 5000,
      rent: 2000,
      insurance: 400,
      addedLines: [
        {
          id: saving.id,
          label: saving.label,
          kind: saving.kind,
          amount: 500,
        },
      ],
    };

    assert.equal(committedExpenses(input), 2900);
    assert.equal(availableToSpend(input), 2100);
    assert.equal(formatMoney(2100, "CHF"), "2’100 CHF");
  });

  it("keeps a deficit usable instead of blocking", () => {
    const input: BudgetInputs = {
      ...EMPTY_BUDGET,
      income: 1000,
      rent: 2000,
    };

    assert.equal(availableToSpend(input), -1000);
  });

  it("toggles a chip off instead of stacking its amount", () => {
    const withGroceries = toggleChip(EMPTY_BUDGET, groceries, "CHF");
    assert.equal(withGroceries.addedLines.length, 1);
    assert.equal(withGroceries.addedLines[0]?.id, "groceries");

    const twice = toggleChip(withGroceries, groceries, "CHF");
    assert.deepEqual(twice.addedLines, []);
    assert.equal(availableToSpend({ ...twice, income: 5000 }), 5000);
  });

  it("keeps the chip id when the amount is edited, then removes the single line", () => {
    const added = toggleChip(EMPTY_BUDGET, groceries, "CHF");
    const edited = updateLineAmount(added, groceries.id, 800);
    assert.equal(edited.addedLines.length, 1);
    assert.equal(edited.addedLines[0]?.id, groceries.id);
    assert.equal(edited.addedLines[0]?.amount, 800);

    const removed = toggleChip(edited, groceries, "CHF");
    assert.deepEqual(removed.addedLines, []);
    assert.equal(availableToSpend({ ...removed, income: 5000 }), 5000);
  });

  it("never holds two lines with the same chip id", () => {
    const once = toggleChip(EMPTY_BUDGET, groceries, "CHF");
    const stillOnce = {
      ...once,
      addedLines: [...once.addedLines, ...once.addedLines],
    };
    const toggled = toggleChip(stillOnce, groceries, "CHF");
    assert.equal(
      toggled.addedLines.filter((line) => line.id === groceries.id).length,
      0,
    );
  });

  it("labels the retirement pillar by visitor currency without changing its id", () => {
    assert.equal(chipLabel(pillar, "CHF"), "3ème pilier");
    assert.equal(chipLabel(pillar, "EUR"), "Épargne retraite");
    assert.equal(pillar.id, "pillar3");

    const chf = toggleChip(EMPTY_BUDGET, pillar, "CHF");
    const eur = toggleChip(EMPTY_BUDGET, pillar, "EUR");
    assert.equal(chf.addedLines[0]?.id, eur.addedLines[0]?.id);
    assert.equal(chf.addedLines[0]?.label, "3ème pilier");
    assert.equal(eur.addedLines[0]?.label, "Épargne retraite");
  });
});
