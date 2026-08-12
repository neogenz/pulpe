import { formatMonthLabel, formatMonthName, ofMonth } from "./date-format";

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
