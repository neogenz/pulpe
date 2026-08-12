import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A Paper chip that hides its check without saying anything else about being
 * selected is invisible when it is: the flat fill is the same either way. The
 * two that legitimately hide it say so another way — the tag picker swaps its
 * icon, the currency picker is outlined throughout — so the rule is that a chip
 * either routes through `FilterChip` or carries its own signal.
 */
describe("chips that hide their selected check", () => {
  it("say they are selected some other way", () => {
    const silent = sourceFiles("src")
      .filter((path) => !path.endsWith("filter-chip.tsx"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        if (!source.includes("showSelectedCheck={false}")) return false;
        return !/icon=|mode="outlined"/.test(source);
      });

    expect(silent).toEqual([]);
  });
});
