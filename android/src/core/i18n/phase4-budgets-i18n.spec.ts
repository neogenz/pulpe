import { monthSubtitle } from "@/features/budgets/month-subtitle";

import { i18n, translate } from "./i18n";

const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("phase 4 budget localization", () => {
  it.each([
    ["fr", "L'été file, ton budget tient", "Janvier se rattrape vite"],
    ["en", "Summer flies by, your budget holds", "Plenty of time to catch up"],
    [
      "de",
      "Der Sommer vergeht, dein Budget hält",
      "Im Januar lässt sich das schnell aufholen",
    ],
    ["it", "L'estate vola, il budget tiene", "Gennaio si recupera in fretta"],
  ])(
    "resolves month subtitles from the live %s catalog",
    (locale, positive, negative) => {
      i18n.locale = locale;
      expect(monthSubtitle(translate, 8, true)).toBe(positive);
      expect(monthSubtitle(translate, 1, false)).toBe(negative);
    },
  );

  it("keeps dates, errors, and accessibility at the presentation boundary", () => {
    const list = readFileSync("src/app/(main)/(tabs)/budgets.tsx", "utf8");
    const create = readFileSync("src/app/(main)/budget/create.tsx", "utf8");

    expect(list).toContain("formatMonthName(month, year, locale)");
    expect(list).toContain('t("budgets.list.createAccessibility")');
    expect(create).toContain(
      "formatMonthLabel(candidate.month, candidate.year, locale)",
    );
    expect(create).toContain('t("budgets.create.error")');
    expect(create).toContain("budgets.isError || templates.isError");
    expect(`${list}\n${create}`).not.toMatch(
      /Aucun budget pour l'instant|Nouveau budget|Le budget n&apos;a pas pu/,
    );
  });
});
