import {
  formatDayMonth,
  formatMonthLabel,
  formatMonthName,
  formatMonthYearShort,
  formatRelativeDay,
  ofMonth,
} from "./date-format";

describe("localized day labels", () => {
  it.each([
    ["fr", "5 août", "aujourd'hui", "hier"],
    ["en", "August 5", "today", "yesterday"],
    ["de", "5. August", "heute", "gestern"],
    ["it", "5 agosto", "oggi", "ieri"],
  ])(
    "formats calendar and relative days in %s",
    (locale, day, today, yesterday) => {
      const now = new Date(2026, 7, 5, 12);
      expect(formatDayMonth(now, locale)).toBe(day);
      expect(formatRelativeDay(now, now, locale)).toBe(today);
      expect(formatRelativeDay(new Date(2026, 7, 4), now, locale)).toBe(
        yesterday,
      );
    },
  );

  it("does not require Intl.RelativeTimeFormat on Hermes", () => {
    const relativeTimeFormat = Intl.RelativeTimeFormat;
    Object.defineProperty(Intl, "RelativeTimeFormat", {
      configurable: true,
      value: undefined,
    });

    try {
      const now = new Date(2026, 7, 5, 12);
      expect(formatRelativeDay(now, now, "en")).toBe("today");
    } finally {
      Object.defineProperty(Intl, "RelativeTimeFormat", {
        configurable: true,
        value: relativeTimeFormat,
      });
    }
  });

  it("keeps the French first-day ordinal by default", () => {
    expect(formatDayMonth(new Date(2026, 7, 1))).toBe("1er août");
    expect(formatDayMonth(new Date(2026, 7, 1), "en")).toBe("August 1");
  });
});

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
