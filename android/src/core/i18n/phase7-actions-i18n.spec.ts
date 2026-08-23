import { readFileSync } from "@/core/testing/source-files";
import { i18n, translate } from "./i18n";

describe("phase 7 budget action localization", () => {
  it.each([
    ["fr", "Un mois un peu juste ?", "Sélectionne au moins un mois"],
    ["en", "A tight month?", "Select at least one month"],
    ["de", "Ein knapper Monat?", "Wähle mindestens einen Monat"],
    ["it", "Un mese un po' stretto?", "Seleziona almeno un mese"],
  ])(
    "resolves action copy from the live %s catalog",
    (locale, card, problem) => {
      i18n.locale = locale;
      expect(translate("budgets.actions.withdrawal.cardTitle")).toBe(card);
      expect(
        translate("budgets.actions.spread.problem.min", { count: 1 }),
      ).toBe(problem);
    },
  );

  it("keeps scheduled withdrawal kind and recurrence locked", () => {
    const sheet = readFileSync(
      "src/features/budget-details/components/budget-line-sheet.tsx",
      "utf8",
    );
    expect(sheet.match(/disabled: isPlannedWithdrawal/g)).toHaveLength(2);
  });
});
