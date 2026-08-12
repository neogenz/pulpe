/**
 * Every `.tsx` under a directory, for the guards that assert something about
 * the source itself rather than about what it renders.
 *
 * `requireActual`, because `jest.setup.js` mocks a good deal of the native side
 * and a guard that reads the tree has to read the real one.
 */
const { readdirSync } = jest.requireActual<{
  readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
}>("node:fs");

export const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

export function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}
