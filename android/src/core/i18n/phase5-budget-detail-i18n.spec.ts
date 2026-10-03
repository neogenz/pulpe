import { i18n, translate } from "./i18n";

describe("phase 5 budget detail localization", () => {
  it.each([
    ["fr", "Disponible à dépenser", "Budget dépassé"],
    ["en", "Available to spend", "Over budget"],
    ["de", "Verfügbar zum Ausgeben", "Budget überschritten"],
    ["it", "Disponibile da spendere", "Budget superato"],
  ])(
    "resolves reading states from the live %s catalog",
    (locale, hero, status) => {
      i18n.locale = locale;
      expect(translate("budgets.detail.hero.available")).toBe(hero);
      expect(translate("budgets.detail.status.overBudget")).toBe(status);
    },
  );
});
