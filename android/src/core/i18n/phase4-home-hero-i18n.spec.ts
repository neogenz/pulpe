const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

describe("phase 4 home hero presentation boundary", () => {
  it("resolves home states, dates, hero copy, and chart accessibility live", () => {
    const home = readFileSync("src/app/(main)/(tabs)/home.tsx", "utf8");
    const hero = readFileSync(
      "src/features/current-month/components/home-hero-card.tsx",
      "utf8",
    );
    const chart = readFileSync(
      "src/features/current-month/components/balance-trajectory-chart.tsx",
      "utf8",
    );
    const presentation = readFileSync(
      "src/features/current-month/home-hero-presentation.ts",
      "utf8",
    );

    expect(home).toContain("formatMonthName(");
    expect(home).toContain("locale,");
    expect(home).toContain('t("home.states.loadErrorTitle")');
    expect(hero).toContain('t("home.hero.metricsAccessibility"');
    expect(chart).toContain('accessibilityRole="image"');
    expect(chart).toContain('t("home.hero.chartAccessibility")');
    expect(chart).toContain('t("home.hero.chart.today")');
    expect(chart).not.toMatch(/aujourd'hui/);
    expect(presentation).toContain("t(`home.hero.verdict.${verdict}Dated`");
    expect(`${home}\n${hero}`).not.toMatch(
      /On n'a pas pu charger ton mois|Estimé fin \$|Voir le détail du budget/,
    );
  });
});
