import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A screen's main action is a floating action button: that is where an Android
 * user looks for it. iOS puts the same actions in the content and the
 * navigation bar, which is right on iOS and nowhere else.
 *
 * A floating button floats: it is out of the layout, so nothing moves aside for
 * it and the last row of a list ends up underneath it. The screen cannot know
 * how tall the button is, so it does not guess: `FAB_CLEARANCE` is the one
 * number, and a screen that renders a FAB has to spend it.
 */
describe("floating action buttons", () => {
  it("leave the content underneath room to be read", () => {
    const unguarded = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /<FAB[\s.]/.test(source) && !source.includes("FAB_CLEARANCE");
    });

    expect(unguarded).toEqual([]);
  });

  /**
   * M3 spends the extended form on the action a screen is *for*, and the width
   * it costs is the reason there is only ever one. Adding an operation is what
   * the app is opened for, and noting an amount is what a line's page is for;
   * writing a budget, a model or a goal happens once and then rarely, and each
   * of those screens names the action in its own empty state, where a newcomer
   * actually is. So the plus sign carries them.
   */
  it("say what they do only where that act is the screen's purpose", () => {
    const labelled = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /<FAB\b[^>]*\slabel=/s.test(source);
    });

    expect(labelled.sort()).toEqual([
      "src/app/(main)/(tabs)/home.tsx",
      "src/app/(main)/budget/[id]/line/[lineId].tsx",
    ]);
  });
});
