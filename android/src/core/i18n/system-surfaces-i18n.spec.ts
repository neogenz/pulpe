import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("system surface localization", () => {
  it.each([
    ["fr", "Pulpe est en maintenance", "Quoi de neuf"],
    ["en", "Pulpe is under maintenance", "What's new"],
    ["de", "Pulpe wird gewartet", "Neuigkeiten"],
    ["it", "Pulpe è in manutenzione", "Novità"],
  ])("serves gate and release copy in %s", (locale, gate, whatsNew) => {
    i18n.locale = locale;
    expect(translate("system.gate.maintenance.title")).toBe(gate);
    expect(translate("system.whatsNew.title")).toBe(whatsNew);
  });

  it("keeps system, settings and inline defaults behind catalog keys", () => {
    const system = readFileSync(
      "src/core/system/system-gate-screen.tsx",
      "utf8",
    );
    const required = readFileSync(
      "src/core/user-settings/required-settings-gate.tsx",
      "utf8",
    );
    const inline = readFileSync("src/core/ui/inline-query-error.tsx", "utf8");

    expect(system).toContain('t("common.retry")');
    expect(required).toContain('t("system.requiredSettings.loading")');
    expect(inline).toContain('t("system.queryError")');
    expect(`${system}\n${required}\n${inline}`).not.toMatch(
      /Réessayer|Chargement de tes préférences|Impossible de charger cette section/,
    );
  });
});
