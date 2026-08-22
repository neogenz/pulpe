import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * Section labels used to be typed in capitals — `"ZONE DE DANGER"` — which set
 * them without the tracking capitals need to stay readable, and handed a screen
 * reader a run of letters instead of a word. `Eyebrow` does the transform in
 * the style layer, so the string stays a sentence and the tracking comes with
 * it. A second `textTransform` elsewhere is that pairing coming apart.
 */
describe("uppercase labels", () => {
  it("are set by `Eyebrow`, which is the only place that tracks them", () => {
    const elsewhere = sourceFiles("src")
      .filter((path) => !path.endsWith("core/ui/eyebrow.tsx"))
      .filter((path) =>
        readFileSync(path, "utf8").includes('textTransform: "uppercase"'),
      );

    expect(elsewhere).toEqual([]);
  });
});
