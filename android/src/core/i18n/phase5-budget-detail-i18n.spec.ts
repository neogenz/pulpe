import { i18n, translate } from "./i18n";

describe("phase 5 budget detail localization", () => {
  it.each([
    ["fr", "Disponible à dépenser", "Dépassées"],
    ["en", "Available to spend", "Over plan"],
    ["de", "Verfügbar zum Ausgeben", "Überschritten"],
    ["it", "Disponibile da spendere", "Superate"],
  ])(
    "resolves reading states from the live %s catalog",
    (locale, hero, status) => {
      i18n.locale = locale;
      expect(translate("budgets.detail.hero.available")).toBe(hero);
      expect(translate("budgets.detail.filters.over")).toBe(status);
    },
  );
});
