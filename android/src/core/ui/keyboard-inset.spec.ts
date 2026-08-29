import { readFileSync, sourceFiles } from "@/core/testing/source-files";

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
      paddingBottom: NAV_BAR,
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
    // The bar is already cleared by the margin; padding it again would leave a
    // blank band between the footer and the keys.
    expect(box.paddingBottom).toBe(0);
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

/**
 * The same defect as the sheets', one layer out. `adjustResize` stopped
 * resizing anything the day the app went edge-to-edge: the IME now arrives as
 * an inset, and a screen that scrolls keeps its full height with the keyboard
 * up. `KeyboardAvoidingView` is no help either — it displaces by
 * `endCoordinates.screenY`, which Android only sets to the top of the keyboard
 * under `SOFT_INPUT_ADJUST_NOTHING`, and the manifest says `adjustResize`.
 *
 * So a screen that scrolls around a field has to pad itself by the inset. A
 * `FormModal` is exempt because it already does it for its children.
 */
describe("screens that scroll around a field", () => {
  const scrollsAroundAField = (source: string) =>
    /<(ScrollView|FlatList|SectionList)/.test(source) &&
    source.includes("TextInput") &&
    !source.includes("<FormModal");

  it("pad themselves by the keyboard the window no longer subtracts", () => {
    const blind = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        scrollsAroundAField(source) && !source.includes("useKeyboardHeight")
      );
    });

    expect(blind).toEqual([]);
  });
});
