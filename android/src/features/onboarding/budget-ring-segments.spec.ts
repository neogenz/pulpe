import { ringGeometry } from "./budget-ring-segments";

describe("ringGeometry", () => {
  it("splits the income into charges, savings and what is left", () => {
    const ring = ringGeometry(1000, 500, 250);
    expect(ring.charges).toEqual({ start: 0, end: 0.5 });
    expect(ring.savings).toEqual({ start: 0.5, end: 0.75 });
    expect(ring.rest).toEqual({ start: 0.75, end: 1 });
    expect(ring.overrun).toBe(0);
  });

  it("closes the ring on the spending and reports the excess when it overruns", () => {
    const ring = ringGeometry(1000, 1000, 500);
    expect(ring.rest).toEqual({ start: 1, end: 1 });
    expect(ring.overrun).toBeCloseTo(1 / 3);
  });

  it("draws nothing without income or spending", () => {
    const ring = ringGeometry(0, 0, 0);
    expect(ring.rest).toEqual({ start: 0, end: 0 });
    expect(ring.overrun).toBe(0);
  });
});
