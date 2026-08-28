import { readFileSync, sourceFiles } from "@/core/testing/source-files";

const OPACITY = /opacity:\s*([^,\n}]+)/g;
/** Comments explain these failures by quoting them; only code is scanned. */
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/.*/g;

/**
 * Opacity is the one property that quietly breaks a contrast contract. Every
 * colour in `theme.ts` was resolved against a background; laying an opacity
 * over the view that holds it composites ink and background into a third colour
 * nobody chose, and the text inside goes with it.
 *
 * It has been found three times under three names — `POINTED_OPACITY` at 0.55
 * on a budget line, `DIMMED_OPACITY` at 0.55 on a plan month, `PAST_OPACITY` at
 * 0.5 on a spread instalment — each one a local constant that read as a design
 * decision and measured as a failure: 2.70:1 and 2.42:1 for the metadata under
 * them, against the 4.5:1 those roles are resolved for. Each was fixed where it
 * was found, and reappeared somewhere else, because what was wrong was never
 * the number.
 *
 * `EMPHASIS` is the whole of the answer: `pending` is worn for the length of a
 * request and `disabled` by a control with no contrast contract left to keep,
 * and neither dims text that still has to be read. Something that has to step
 * back while staying legible does it through its ink — `onSurfaceVariant`, or
 * `Amount`'s `muted` tone, which is that role by another name.
 */
describe("opacity", () => {
  it("only ever comes from EMPHASIS", () => {
    const freehand = sourceFiles("src").flatMap((path) => {
      const source = readFileSync(path, "utf8").replace(COMMENTS, "");
      OPACITY.lastIndex = 0;
      const offenders: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = OPACITY.exec(source)) !== null) {
        const value = match[1].trim();
        if (!value.includes("EMPHASIS.")) offenders.push(`${path}: ${value}`);
      }
      return offenders;
    });

    expect(freehand).toEqual([]);
  });
});
