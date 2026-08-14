import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * Tabular figures are the reason a column of amounts lines up, and they were
 * being asked for by hand at eighty-odd call sites — so the ones that forgot
 * jittered by a digit's width as the number changed. `Amount` is now the only
 * thing that sets them, which also makes it the only thing that decides how
 * large an amount is: the sizes were a free-for-all before, and a row total
 * could outrank the screen's own headline.
 */
describe("amounts", () => {
  it("get their tabular figures from `Amount` alone", () => {
    const handRolled = sourceFiles("src")
      .filter((path) => !path.startsWith("src/core/ui/"))
      .filter((path) => readFileSync(path, "utf8").includes("TABULAR_DIGITS"));

    expect(handRolled).toEqual([]);
  });
});
