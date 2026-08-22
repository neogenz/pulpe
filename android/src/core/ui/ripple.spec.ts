import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A bare `Pressable` gives nothing back on Android: the finger lands, and the
 * screen stays as it was until whatever the tap started has finished. That is
 * how a budget line came to read as unresponsive on the most-tapped surface of
 * the app, and it is the single loudest tell that a screen was drawn for
 * somewhere else.
 *
 * `useRipple` owns the colour, so the guard only asks that every pressable
 * takes one.
 */
describe("pressable surfaces", () => {
  it("acknowledge a touch before anything else happens", () => {
    const silent = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      const pressables = source.match(/<Pressable\b/g)?.length ?? 0;
      const ripples = source.match(/android_ripple=/g)?.length ?? 0;
      return pressables > ripples;
    });

    expect(silent).toEqual([]);
  });
});
