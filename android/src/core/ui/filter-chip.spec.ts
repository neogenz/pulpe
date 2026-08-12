import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * A Paper chip that hides its check without saying anything else about being
 * selected is invisible when it is: the flat fill is the same either way. The
 * one place that still hides it — the currency picker — is outlined throughout
 * and reads as a pair of choices rather than a filter, so the rule is that a
 * chip either routes through `FilterChip` or is outlined in both states.
 */
describe("chips that hide their selected check", () => {
  it("say they are selected some other way", () => {
    const silent = sourceFiles("src")
      .filter((path) => !path.endsWith("filter-chip.tsx"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        if (!source.includes("showSelectedCheck={false}")) return false;
        return !source.includes('mode="outlined"');
      });

    expect(silent).toEqual([]);
  });
});
