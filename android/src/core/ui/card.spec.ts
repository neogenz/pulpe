import { readFileSync, sourceFiles } from "@/core/testing/source-files";

const PAPER_IMPORT =
  /import\s*(?:type\s*)?{([^}]*)}\s*from\s*"react-native-paper"/gs;

/**
 * Paper computes a card's corner as `3 × roundness`, and this app sets
 * `roundness` to `RADIUS.sm` for everything else it governs — so a Paper card
 * landed at 24 next to a hand-built one at `RADIUS.card`, 18. The wrapper in
 * `card.tsx` passes the radius down; importing Paper's `Card` directly walks
 * straight back into the mismatch, and nothing in a screenshot names the cause.
 */
describe("cards", () => {
  it("come from the wrapper, never from Paper directly", () => {
    const direct = sourceFiles("src")
      .filter((path) => !path.endsWith("core/ui/card.tsx"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        PAPER_IMPORT.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = PAPER_IMPORT.exec(source)) !== null) {
          if (/\bCard\b/.test(match[1])) return true;
        }
        return false;
      });

    expect(direct).toEqual([]);
  });
});
