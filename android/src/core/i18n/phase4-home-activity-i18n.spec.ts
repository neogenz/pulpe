import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("phase 4 current-month activity localization", () => {
  it.each([
    ["fr", "Jour 3 sur 30 · jusqu'au 24 août", "2 mouvements"],
    ["en", "Day 3 of 30 · until 24 August", "2 movements"],
    ["de", "Tag 3 von 30 · bis 24 August", "2 Bewegungen"],
    ["it", "Giorno 3 di 30 · fino al 24 August", "2 movimenti"],
  ])(
    "serves the period caption and plurals in %s",
    (locale, caption, count) => {
      i18n.locale = locale;
      const date = locale === "fr" ? "24 août" : "24 August";
      expect(translate("home.periodCaption", { day: 3, total: 30, date })).toBe(
        caption,
      );
      expect(
        translate("home.movements.subtitle", { month: "x", count: 2 }),
      ).toBe(`x · ${count}`);
    },
  );

  it("keeps dates and pointing failures semantic until render", () => {
    const section = readFileSync(
      "src/features/current-month/components/recent-movements-section.tsx",
      "utf8",
    );
    const home = readFileSync("src/app/(main)/(tabs)/home.tsx", "utf8");

    expect(section).toContain("formatRelativeDay(day.date, now, locale)");
    expect(home).toContain('step: "point" | "undo"');
    expect(home).toContain("t(`home.checking.${current.step}Failure`)");
    expect(`${section}\n${home}`).not.toMatch(
      /Le pointage n'a pas été enregistré/,
    );
  });
});
