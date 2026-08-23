import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("settings tags localization", () => {
  it.each([
    ["fr", "Mes tags", "Renommer Courses"],
    ["en", "My tags", "Rename Courses"],
    ["de", "Meine Tags", "Courses umbenennen"],
    ["it", "I miei tag", "Rinomina Courses"],
  ])("serves tag and accessibility copy in %s", (locale, title, rename) => {
    i18n.locale = locale;
    expect(translate("settings.tags.title")).toBe(title);
    expect(translate("settings.tags.renameA11y", { name: "Courses" })).toBe(
      rename,
    );
  });

  it("keeps query errors distinct and mutation targets locked while pending", () => {
    const settings = readFileSync("src/app/(main)/settings/tags.tsx", "utf8");
    const picker = readFileSync("src/features/tags/tag-picker.tsx", "utf8");

    expect(settings).toContain(
      "const hasLoadError = tags.isError && tags.data === undefined",
    );
    expect(picker).toContain(
      "const hasLoadError = tags.isError && tags.data === undefined",
    );
    expect(settings).toContain("if (!rename.isPending) setRenamedTag(null)");
    expect(settings).toContain("if (!remove.isPending) setDeletedTag(null)");
    expect(settings).toContain("disabled={rename.isPending}");
    expect(settings).toContain("disabled={remove.isPending}");
    expect(`${settings}\n${picker}`).not.toMatch(
      /title="Mes tags"|accessibilityLabel="Chargement"|Renommer le tag/,
    );
  });
});
