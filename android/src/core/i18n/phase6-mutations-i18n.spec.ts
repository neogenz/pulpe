import { i18n, translate } from "./i18n";

describe("phase 6 mutation localization", () => {
  it.each([
    ["fr", "Nouvelle prévision", "Opération ajoutée"],
    ["en", "New forecast", "Entry added"],
    ["de", "Neue Planung", "Vorgang hinzugefügt"],
    ["it", "Nuova previsione", "Movimento aggiunto"],
  ])(
    "resolves mutation copy from the live %s catalog",
    (locale, title, outcome) => {
      i18n.locale = locale;
      expect(translate("budgets.mutations.forecast.createTitle")).toBe(title);
      expect(translate("budgets.mutations.outcome.activityAdded")).toBe(
        outcome,
      );
    },
  );
});
