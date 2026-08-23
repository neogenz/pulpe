// Lives here and not next to `_layout.tsx`: expo-router builds its routes from
// a `require.context` over `src/app`, which sweeps up every file it finds. A
// spec placed there is bundled as a route and evaluated in the app, where
// `jest` does not exist — it crashes the running app, not the test run.
//
// `jest.requireActual` rather than an import: `@types/node` is deliberately not
// installed, so that Node globals cannot typecheck their way into app code.
const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

const layout = readFileSync("src/app/_layout.tsx", "utf8");
const systemGate = readFileSync(
  "src/core/system/system-gate-screen.tsx",
  "utf8",
);

describe("root provider order", () => {
  it("should keep QueryClientProvider outside PaperProvider", () => {
    // A Paper `Portal` re-renders its children under the `Portal.Host` that
    // `PaperProvider` mounts, so those children read the context of that spot
    // in the tree rather than of where they were written. Every sheet in the
    // app is a Portal, and several call query hooks: with Paper on the outside
    // they throw "No QueryClient set" at render — a failure no type or lint
    // check can see, and one that surfaces only once a sheet is opened.
    const query = layout.indexOf("<QueryClientProvider");
    const paper = layout.indexOf("<PaperProvider");

    expect(query).toBeGreaterThan(-1);
    expect(paper).toBeGreaterThan(-1);
    expect(query).toBeLessThan(paper);
  });

  it("should keep the system gate above Paper portals", () => {
    expect(systemGate).toContain(
      'import { Linking, Modal, StyleSheet, View } from "react-native"',
    );
    expect(systemGate).toContain("onRequestClose={() => undefined}");
    expect(layout.indexOf("<SystemGateScreen")).toBeGreaterThan(
      layout.indexOf("<WhatsNewSheet"),
    );
  });
});
