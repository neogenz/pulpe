const { readdirSync, readFileSync } = jest.requireActual<{
  readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

function screenFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return screenFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/** The `edges` the file hands its `SafeAreaView`, or null when it sets none. */
function declaredEdges(source: string): string[] | null {
  const match = /edges=\{\[([^\]]*)\]\}/.exec(source);
  if (match === null) return null;
  return [...match[1].matchAll(/"([a-z]+)"/g)].map((edge) => edge[1]);
}

/**
 * Window insets are paid by whoever is closest to the edge, and exactly once.
 *
 * `Appbar.Header` insets itself against the status bar and the tab bar insets
 * itself against the gesture bar, so a `SafeAreaView` that also claims those
 * edges adds a second copy of each: a dead band under the clock, and a dead
 * strip above the tabs. It showed up on every screen at once, and nothing in
 * the type system or the linter had an opinion about it.
 */
describe("screen insets", () => {
  const files = screenFiles("src").filter((path) =>
    readFileSync(path, "utf8").includes("<SafeAreaView"),
  );

  it("finds the screens to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("never pays the top inset a screen's own app bar already pays", () => {
    const doubled = files.filter((path) => {
      const source = readFileSync(path, "utf8");
      if (!source.includes("Appbar.Header")) return false;
      const edges = declaredEdges(source);
      return edges === null || edges.includes("top");
    });

    expect(doubled).toEqual([]);
  });

  it("never pays the bottom inset the tab bar already pays", () => {
    const doubled = files
      .filter((path) => path.includes("/(tabs)/"))
      .filter((path) => {
        const edges = declaredEdges(readFileSync(path, "utf8"));
        return edges === null || edges.includes("bottom");
      });

    expect(doubled).toEqual([]);
  });
});
