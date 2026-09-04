import { i18n, translate } from "./i18n";

describe("budget planning plurals", () => {
  it.each([
    [
      "fr",
      "1 période",
      "1 budget créé, 2 budgets existants ignorés",
      "2 budgets créés, 1 budget existant ignoré",
    ],
    [
      "en",
      "1 period",
      "1 budget created, 2 existing budgets skipped",
      "2 budgets created, 1 existing budget skipped",
    ],
    [
      "de",
      "1 Periode",
      "1 Budget erstellt, 2 vorhandene Budgets übersprungen",
      "2 Budgets erstellt, 1 vorhandenes Budget übersprungen",
    ],
    [
      "it",
      "1 periodo",
      "1 budget creato, 2 budget esistenti ignorati",
      "2 budget creati, 1 budget esistente ignorato",
    ],
  ])(
    "uses independent singulars in %s",
    (locale, onePeriod, oneCreated, oneSkipped) => {
      i18n.locale = locale;

      expect(translate("budgets.plan.periodCount", { count: 1 })).toBe(
        onePeriod,
      );
      expect(result(1, 2)).toBe(oneCreated);
      expect(result(2, 1)).toBe(oneSkipped);
    },
  );
});

function result(createdCount: number, skippedCount: number): string {
  return translate("budgets.plan.result", {
    created: translate("budgets.plan.resultCreated", { count: createdCount }),
    skipped: translate("budgets.plan.resultSkipped", { count: skippedCount }),
  });
}
