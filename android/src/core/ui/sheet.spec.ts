const { readdirSync, readFileSync } = jest.requireActual<{
  readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

/**
 * The one panel that may hold a raw `Modal`: three centred elements, no scroll,
 * and no action that could be pushed anywhere.
 */
const ALLOWED = [
  "src/core/ui/sheet.tsx",
  "src/features/current-month/components/notification-prime-sheet.tsx",
];

/**
 * Sixteen sheets each capped themselves at `maxHeight: "88%"`, and a percentage
 * of the window does not shrink when the soft keyboard opens: the keyboard took
 * the bottom third of a sheet that still believed it was full height, and the
 * submit button went under it. `Sheet` measures the window it actually has and
 * pins its actions, so the fix has to hold for the next sheet too.
 */
describe("sheets", () => {
  it("never re-implements the modal a sheet is made of", () => {
    const raw = sourceFiles("src").filter(
      (path) =>
        readFileSync(path, "utf8").includes("<Modal") &&
        !ALLOWED.includes(path),
    );

    expect(raw).toEqual([]);
  });

  it("never caps a sheet at a share of a window the keyboard does not shrink", () => {
    const capped = sourceFiles("src").filter((path) =>
      /maxHeight:\s*"\d+%"/.test(readFileSync(path, "utf8")),
    );

    expect(capped).toEqual([]);
  });
});
