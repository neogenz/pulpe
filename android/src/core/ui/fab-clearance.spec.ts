import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A floating button floats: it is out of the layout, so nothing moves aside for
 * it and the last row of a list ends up underneath it. Four of the five screens
 * that carry one left `SPACING.xxl` under their content — forty points against
 * a button fifty-six tall — and each buried its own last action: "Préparer le
 * mois suivant" on the home screen, sitting under the button that hid it.
 *
 * The screen cannot know how tall the button is, so it does not guess:
 * `FAB_CLEARANCE` is the one number, and a screen that renders a FAB has to
 * spend it.
 */
describe("floating action buttons", () => {
  it("leave the content underneath room to be read", () => {
    const unguarded = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return /<FAB[\s.]/.test(source) && !source.includes("FAB_CLEARANCE");
    });

    expect(unguarded).toEqual([]);
  });
});
