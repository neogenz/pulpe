import { sheetBox, SHEET_HEIGHT_RATIO } from "./keyboard-inset";

const WINDOW_HEIGHT = 800;
const NAV_BAR = 24;

describe("sheetBox", () => {
  it("gives a sheet the whole window while the keyboard is down", () => {
    const box = sheetBox({
      windowHeight: WINDOW_HEIGHT,
      keyboardHeight: 0,
      safeBottom: NAV_BAR,
    });

    expect(box).toEqual({
      maxHeight: WINDOW_HEIGHT * SHEET_HEIGHT_RATIO,
      marginBottom: 0,
    });
  });

  it("lifts the sheet clear of the keyboard and of the bar under it", () => {
    const box = sheetBox({
      windowHeight: WINDOW_HEIGHT,
      keyboardHeight: 300,
      safeBottom: NAV_BAR,
    });

    // React Native reports the keyboard above the navigation bar, so the sheet
    // has to step over both or it lands on the gesture pill.
    expect(box.marginBottom).toBe(324);
  });

  it("caps the body against the room the keyboard left, not the whole window", () => {
    const box = sheetBox({
      windowHeight: WINDOW_HEIGHT,
      keyboardHeight: 300,
      safeBottom: NAV_BAR,
    });

    expect(box.maxHeight).toBe((WINDOW_HEIGHT - 324) * SHEET_HEIGHT_RATIO);
    // The regression this exists for: a cap read from the window alone, which
    // is the same number with the keyboard up as with it down.
    expect(box.maxHeight).toBeLessThan(WINDOW_HEIGHT * SHEET_HEIGHT_RATIO);
  });

  it("keeps the pinned footer on screen on a short window", () => {
    const box = sheetBox({
      windowHeight: 640,
      keyboardHeight: 320,
      safeBottom: 0,
    });

    expect(box.maxHeight + box.marginBottom).toBeLessThanOrEqual(640);
  });
});
