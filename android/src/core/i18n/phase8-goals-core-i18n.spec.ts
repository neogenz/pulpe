import { readFileSync } from "@/core/testing/source-files";
import { formatIsoDate } from "@/core/ui/date-format";
import { i18n, translate } from "./i18n";

describe("phase 8 savings goal localization", () => {
  it.each([
    ["fr", "Objectifs d'épargne", "30 nov. 2026"],
    ["en", "Savings goals", "Nov 30, 2026"],
    ["de", "Sparziele", "30. Nov. 2026"],
    ["it", "Obiettivi di risparmio", "30 nov 2026"],
  ])("resolves core goal copy and dates in %s", (locale, title, date) => {
    i18n.locale = locale;
    expect(translate("goals.list.title")).toBe(title);
    expect(formatIsoDate("2026-11-30", locale)).toBe(date);
    expect(
      translate("goals.form.suggestion", { amount: "100 CHF" }),
    ).not.toContain("%{");
    expect(translate("goals.plan.unlinked", { count: 2 })).not.toContain("%{");
  });

  it("gates the goals intro on required settings", () => {
    const screen = readFileSync("src/app/(main)/(tabs)/goals.tsx", "utf8");
    expect(screen.indexOf("settings.isError")).toBeLessThan(
      screen.indexOf("if (isIntroVisible)"),
    );
  });
});
