import {
  formatMonthLabel,
  formatMonthName,
  formatMonthYearShort,
  ofMonth,
} from "./date-format";

describe("formatMonthYearShort", () => {
  it("abbreviates the long month names", () => {
    expect(formatMonthYearShort(1, 2026)).toBe("janv. 2026");
    expect(formatMonthYearShort(10, 2026)).toBe("oct. 2026");
    expect(formatMonthYearShort(12, 2026)).toBe("déc. 2026");
  });

  it("leaves whole the ones French does not abbreviate", () => {
    expect(formatMonthYearShort(3, 2026)).toBe("mars 2026");
    expect(formatMonthYearShort(5, 2026)).toBe("mai 2026");
    expect(formatMonthYearShort(8, 2026)).toBe("août 2026");
  });
});

describe("formatMonthLabel", () => {
  it.each([
    ["fr-CH", "Août 2026"],
    ["en-CH", "August 2026"],
    ["de-CH", "August 2026"],
    ["it-CH", "Agosto 2026"],
  ])("formats the month in %s", (locale, expected) => {
    expect(formatMonthLabel(8, 2026, locale)).toBe(expected);
  });
});

describe("ofMonth", () => {
  it("elides before the three months that start with a vowel", () => {
    expect(ofMonth(formatMonthName(4, 2026))).toBe("d'avril");
    expect(ofMonth(formatMonthName(8, 2026))).toBe("d'août");
    expect(ofMonth(formatMonthName(10, 2026))).toBe("d'octobre");
  });

  it("keeps the article everywhere else", () => {
    expect(ofMonth(formatMonthName(1, 2026))).toBe("de janvier");
    expect(ofMonth(formatMonthName(11, 2026))).toBe("de novembre");
  });

  // Labels that lead a sentence are capitalised, and the accent survives it.
  it("reads the first letter whatever its case", () => {
    expect(ofMonth(formatMonthLabel(8, 2026))).toBe("d'Août 2026");
    expect(ofMonth(formatMonthLabel(12, 2026))).toBe("de Décembre 2026");
  });
});
