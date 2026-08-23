import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * `useColorScheme()` returns `null` when the system has not said, and twenty
 * screens each wrote their own `=== "dark" ? … : …` to decide what that meant.
 * They happened to agree; nothing made them. The hooks in `scheme-colors.ts`
 * are the single place that resolves it, so indexing a palette anywhere else is
 * a twenty-first opinion waiting to disagree.
 */
describe("the financial and hero palettes", () => {
  it("are only ever indexed by the scheme hooks", () => {
    const indexed = sourceFiles("src")
      .filter((path) => !path.endsWith("core/ui/scheme-colors.ts"))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return (
          source.includes("FINANCIAL_COLORS[") ||
          source.includes("HOME_HERO_COLORS[")
        );
      });

    expect(indexed).toEqual([]);
  });
});
