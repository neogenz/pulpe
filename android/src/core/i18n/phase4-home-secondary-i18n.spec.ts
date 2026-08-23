import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("phase 4 current-month secondary localization", () => {
  it.each([
    ["fr", "Suivi du budget", "On te fait signe le jour de paie ?"],
    ["en", "Budget tracking", "Shall we remind you on payday?"],
    ["de", "Budgetverlauf", "Sollen wir dich am Zahltag erinnern?"],
    ["it", "Andamento del budget", "Ti avvisiamo il giorno di paga?"],
  ])("serves secondary sheet copy in %s", (locale, tracking, reminder) => {
    i18n.locale = locale;
    expect(translate("home.realized.title")).toBe(tracking);
    expect(translate("home.reminderPrime.title")).toBe(reminder);
  });

  it("keeps secondary sheet copy at the presentation boundary", () => {
    const source = ["realized-balance-sheet", "notification-prime-sheet"]
      .map((name) =>
        readFileSync(
          `src/features/current-month/components/${name}.tsx`,
          "utf8",
        ),
      )
      .join("\n");

    expect(source).toContain('t("home.realized.title")');
    expect(source).toContain('t("home.reminderPrime.title")');
    expect(source).not.toMatch(
      /Suivi du budget|Activer les rappels|Solde à date/,
    );
  });
});
