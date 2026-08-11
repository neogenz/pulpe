import {
  formatCompactAmount,
  formatCompactCurrency,
  formatCurrency,
  formatSignedCompactCurrency,
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

  it("should mask every shape once amounts are hidden", () => {
    // All four, because one that forgot would be the only figure on screen.
    toggleAmountVisibility();

    expect(formatCurrency(1234.5, "CHF")).toBe(MASK);
    expect(formatCompactCurrency(1234.5, "CHF")).toBe(MASK);
    expect(formatCompactAmount(1234.5, "CHF")).toBe(MASK);
    expect(formatSignedCompactCurrency(1234.5, "CHF")).toBe(MASK);
  });

  it("should come back unmasked", () => {
    toggleAmountVisibility();
    toggleAmountVisibility();

    expect(formatCompactCurrency(120, "CHF")).toBe("120 CHF");
  });
});
