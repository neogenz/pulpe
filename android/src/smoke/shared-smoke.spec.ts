import { runSharedSmoke, SMOKE_DATE } from "./shared-smoke";

describe("shared-smoke", () => {
  const result = runSharedSmoke(SMOKE_DATE);

  it("should compute amounts through BudgetFormulas", () => {
    expect(parseAmount(result.available)).toBe(6740);
    expect(parseAmount(result.remaining)).toBeCloseTo(2559.45, 2);
  });

  it("should format amounts with the shared CHF formatter", () => {
    expect(result.currency).toBe("CHF");
    expect(result.available).toMatch(/CHF$/);
  });

  it("should resolve the budget period from the pay day", () => {
    // The exact labels come from the runtime's ICU, so lock the shape, not the
    // abbreviations. Hermes itself is proven by the smoke screen on device.
    expect(result.period).toMatch(/^\d{1,2} \S+ - \d{1,2} \S+$/);
  });
});

/** Strips the symbol and the de-CH thousands separators. */
function parseAmount(formatted: string): number {
  return Number(formatted.replace(/[^\d.,-]/g, "").replace(",", "."));
}
