import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("phase 4 current-month activity localization", () => {
  it.each([
    ["fr", "Dernier jour de la période", "+2 autres enveloppes"],
    ["en", "Last day of the period", "+2 other forecasts"],
    ["de", "Letzter Tag der Periode", "+2 weitere Prognosen"],
    ["it", "Ultimo giorno del periodo", "+2 altre previsioni"],
  ])("serves activity status and plurals in %s", (locale, period, hidden) => {
    i18n.locale = locale;
    expect(translate("home.periodRemaining", { count: 1 })).toBe(period);
    expect(translate("home.drift.hidden", { count: 2 })).toBe(hidden);
  });

  it("keeps dates and pointing failures semantic until render", () => {
    const activityWindow = readFileSync(
      "src/features/current-month/activity-window.ts",
      "utf8",
    );
    const activityCard = readFileSync(
      "src/features/current-month/components/activity-card.tsx",
      "utf8",
    );
    const home = readFileSync("src/app/(main)/(tabs)/home.tsx", "utf8");

    expect(activityWindow).not.toContain("formatRelativeDay");
    expect(activityCard).toContain("formatRelativeDay(day.date, now, locale)");
    expect(home).toContain('"point" | "undo" | null');
    expect(home).toContain("t(`home.checking.${toggleFailure}Failure`)");
    expect(`${activityCard}\n${home}`).not.toMatch(
      /Activité sur \$|Le pointage n'a pas été enregistré|Dernier jour de la période/,
    );
  });
});
