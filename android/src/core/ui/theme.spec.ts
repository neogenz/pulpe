import { elevationLadder, pulpeDarkTheme, pulpeLightTheme } from "./theme";

describe("elevationLadder", () => {
  it("leaves the unelevated level uncoloured", () => {
    expect(elevationLadder("#FFFFFF", "#006E25").level0).toBe("transparent");
  });

  it("tints the surface with the brand, a little more at each level", () => {
    const ladder = elevationLadder("#FFFFFF", "#006E25");

    expect(ladder.level1).toBe("#f2f8f4");
    expect(ladder.level3).toBe("#e3efe7");
    expect(ladder.level5).toBe("#dbebe0");
  });

  it("lightens instead when the surface is the dark one", () => {
    const ladder = elevationLadder("#1A1816", "#7EDB83");

    expect(ladder.level1).toBe("#1f221b");
    expect(ladder.level5).toBe("#283325");
  });
});

/**
 * The whole point of the ladder: nothing in either theme falls back to MD3's
 * baseline, whose elevated surfaces are tinted purple.
 */
describe("the themes", () => {
  it("carry an elevation ladder of their own", () => {
    expect(pulpeLightTheme.colors.elevation.level3).toBe("#e3efe7");
    expect(pulpeDarkTheme.colors.elevation.level3).toBe("#252d22");
  });
});
