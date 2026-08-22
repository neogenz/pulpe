import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * Paper paints a `Snackbar` with MD3's inverse roles, which in a dark theme is a
 * near-white slab across a near-black screen — and Android floats a FAB over it
 * whatever the tree order says. Both answers belong to `Notice`, once, or the
 * next toast written anywhere will quietly get neither.
 */
describe("toasts", () => {
  it("reach Paper's `Snackbar` through `Notice` alone", () => {
    const handRolled = sourceFiles("src")
      .filter((path) => path !== "src/core/ui/notice.tsx")
      .filter((path) => /\bSnackbar\b/.test(readFileSync(path, "utf8")));

    expect(handRolled).toEqual([]);
  });
});
