import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("phase 4 shell localization", () => {
  it.each([
    ["fr", ["Accueil", "Budgets", "Objectifs", "Modèles"]],
    ["en", ["Home", "Budgets", "Goals", "Templates"]],
    ["de", ["Start", "Budgets", "Ziele", "Vorlagen"]],
    ["it", ["Home", "Budget", "Obiettivi", "Modelli"]],
  ])("serves deliberately short tab labels in %s", (locale, expected) => {
    i18n.locale = locale;
    expect(
      ["home", "budgets", "goals", "templates"].map((tab) =>
        translate(`main.tabs.${tab}.short`),
      ),
    ).toEqual(expected);
  });

  it("keeps shell and handoff presentation behind catalog keys", () => {
    const tabs = readFileSync("src/app/(main)/(tabs)/_layout.tsx", "utf8");
    const handoff = readFileSync("src/app/(main)/post-onboarding.tsx", "utf8");

    expect(tabs).toContain(
      'tabBarAccessibilityLabel: t("main.tabs.home.accessibility")',
    );
    expect(handoff).toContain('t("main.handoff.future.description")');
    expect(`${tabs}\n${handoff}`).not.toMatch(
      /title: "Accueil"|Ton budget est prêt|Pointe ce qui est arrivé|Commencer/,
    );
  });
});
