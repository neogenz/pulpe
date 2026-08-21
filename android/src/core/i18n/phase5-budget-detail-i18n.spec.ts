import { i18n, translate } from "./i18n";

describe("phase 5 budget detail localization", () => {
  it.each([
    ["fr", "Disponible", "Budget dépassé"],
    ["en", "Available", "Over budget"],
    ["de", "Verfügbar", "Budget überschritten"],
    ["it", "Disponibile", "Budget superato"],
  ])(
    "resolves reading states from the live %s catalog",
    (locale, hero, status) => {
      i18n.locale = locale;
      expect(translate("budgets.detail.hero.available")).toBe(hero);
      expect(translate("budgets.detail.status.overBudget")).toBe(status);
    },
  );
});
