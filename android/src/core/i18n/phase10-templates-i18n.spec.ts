import { readFileSync } from "@/core/testing/source-files";
import { i18n, translate } from "./i18n";

describe("phase 10 template localization", () => {
  it.each([
    ["fr", "Modèles", "Dépenses"],
    ["en", "Templates", "Expenses"],
    ["de", "Vorlagen", "Ausgaben"],
    ["it", "Modelli", "Spese"],
  ])("resolves template copy in %s", (locale, title, section) => {
    i18n.locale = locale;
    expect(translate("templates.list.title")).toBe(title);
    expect(translate("templates.sections.expense")).toBe(section);
    expect(
      translate("templates.lines.propagationBody", { count: 2 }),
    ).not.toContain("%{");
  });

  it("keeps destructive template dialogs locked while writing", () => {
    const detail = readFileSync("src/app/(main)/template/[id].tsx", "utf8");
    expect(detail).toContain("dismissable={!removeLine.isPending}");
    expect(detail).toContain("dismissable={!removeTemplate.isPending}");
  });
});
