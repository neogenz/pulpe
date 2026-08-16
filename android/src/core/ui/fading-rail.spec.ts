import { nextRailEdges } from "./fading-rail";

describe("nextRailEdges", () => {
  it("reuses the current state while scrolling inside the same boundaries", () => {
    const current = { hasLeading: true, hasTrailing: true };

    expect(nextRailEdges(current, 30, 300, 100)).toBe(current);
    expect(nextRailEdges(current, 80, 300, 100)).toBe(current);
  });

  it("changes state only when a boundary appears or disappears", () => {
    const start = { hasLeading: false, hasTrailing: true };
    const middle = nextRailEdges(start, 20, 300, 100);
    const end = nextRailEdges(middle, 200, 300, 100);

    expect(middle).toEqual({ hasLeading: true, hasTrailing: true });
    expect(end).toEqual({ hasLeading: true, hasTrailing: false });
  });
});
