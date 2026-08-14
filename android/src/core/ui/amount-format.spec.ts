import { readFileSync, sourceFiles } from "@/core/testing/source-files";

import {
  formatAmount,
  formatCompactAmount,
  formatCompactCurrency,
  formatCurrency,
  formatSignedCompactCurrency,
  formatSignedCurrency,
} from "./amount-format";
import {
  toggleAmountVisibility,
  useAmountVisibility,
} from "./amount-visibility";

const MASK = "•••";

afterEach(() => {
  useAmountVisibility.setState({ areAmountsHidden: false });
});

describe("amount formatting", () => {
  it("should group Swiss thousands with a typographic apostrophe", () => {
    expect(formatCurrency(1234.5, "CHF")).toBe("1’234.50 CHF");
  });

  it("should sign only what went up", () => {
    expect(formatSignedCompactCurrency(120, "CHF")).toBe("+120 CHF");
    expect(formatSignedCompactCurrency(-120, "CHF")).toBe("-120 CHF");
  });

  /**
   * The budget detail is the screen a line is edited on, and the compact
   * formatter turned forty centimes of headroom into a hero reading "+0" — a
   * sign with nothing after it. iOS has always used the full amount here.
   */
  it("should keep the centimes the budget detail is read for", () => {
    expect(formatAmount(0.4, "CHF")).toBe("0.40");
    expect(formatCompactAmount(0.4, "CHF")).toBe("0");
    expect(formatSignedCurrency(0.4, "CHF")).toBe("+0.40 CHF");
    expect(formatSignedCurrency(-0.4, "CHF")).toBe("-0.40 CHF");
  });

  it("should mask every shape once amounts are hidden", () => {
    // All four, because one that forgot would be the only figure on screen.
    toggleAmountVisibility();

    expect(formatCurrency(1234.5, "CHF")).toBe(MASK);
    expect(formatCompactCurrency(1234.5, "CHF")).toBe(MASK);
    expect(formatCompactAmount(1234.5, "CHF")).toBe(MASK);
    expect(formatSignedCompactCurrency(1234.5, "CHF")).toBe(MASK);
    expect(formatAmount(1234.5, "CHF")).toBe(MASK);
    expect(formatSignedCurrency(1234.5, "CHF")).toBe(MASK);
  });

  it("should come back unmasked", () => {
    toggleAmountVisibility();
    toggleAmountVisibility();

    expect(formatCompactCurrency(120, "CHF")).toBe("120 CHF");
  });
});

/**
 * `getCurrencyFormatter` is the shared web formatter, and on CHF it groups with
 * an ASCII quote where every Pulpe screen groups with the typographic one — so
 * a screen reaching for it prints `3'500.00` beside another printing
 * `3’500.00`. The onboarding flow did exactly that, on five files, until this.
 * It also formats around the mask above, which is the worse half.
 */
describe("the amount formatters", () => {
  it("should be the only ones the app formats money with", () => {
    const bypassing = sourceFiles("src")
      .filter((path) => !path.endsWith("amount-format.ts"))
      .filter((path) =>
        readFileSync(path, "utf8").includes("getCurrencyFormatter"),
      );

    expect(bypassing).toEqual([]);
  });
});
