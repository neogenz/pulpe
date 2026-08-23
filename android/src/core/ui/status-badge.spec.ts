import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A container role is a colour with a matching ink — `primaryContainer` pairs
 * with `onPrimaryContainer`, and nothing else is resolved against it. Painting
 * a whole `Card` with one therefore strands every text inside that the card did
 * not colour by hand: those fall back to `onSurface` and `onSurfaceVariant`,
 * which were resolved for the neutral surface. That is grey ink on a coloured
 * field, and in dark mode the budget list's subtitle sat at 4.36:1 for it.
 *
 * The tint belongs on something small enough to colour completely — the badge,
 * a chip, an icon disc, all of which do carry their `on*Container` ink. The
 * card underneath stays a surface, which is the only thing its text is
 * resolved against.
 *
 * Scoped to `Card` on purpose: `post-onboarding.tsx` and `tooltip.tsx` both
 * paint a container role on a small `View` and colour its contents correctly,
 * so a check that only asked "does this file do both" would call them wrong.
 */
describe("container roles", () => {
  it("tint a badge, never a whole card", () => {
    const repainted = sourceFiles("src").filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        source.includes("<Card") &&
        /backgroundColor:\s*theme\.colors\.\w+Container/.test(source)
      );
    });

    expect(repainted).toEqual([]);
  });
});
