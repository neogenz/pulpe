import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A tint laid over a surface is a colour plus two hex digits of alpha, glued
 * together in a template string. Written by hand it is a number nobody can
 * read back — `"#1DB98A26"` says nothing about how faint that is, and the ones
 * that drifted apart drifted invisibly. `TINT_ALPHA` names the two the app
 * uses, and `Pill` and the ripple are the two things allowed to spend them.
 */
describe("translucent tints", () => {
  it("are mixed inside `core/ui`, never at a call site", () => {
    const handMixed = sourceFiles("src")
      .filter((path) => !path.startsWith("src/core/ui/"))
      .filter((path) => readFileSync(path, "utf8").includes("TINT_ALPHA"));

    expect(handMixed).toEqual([]);
  });
});
