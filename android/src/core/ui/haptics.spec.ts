import { readFileSync, sourceFiles } from "@/core/testing/source-files";

/**
 * Expo's haptic palette is the iOS one, and the call sites had picked five of
 * its waveforms by feel — a PIN key and a confirmed transfer buzzed about the
 * same. Android's actuator does not draw those distinctions anyway. `haptics.ts`
 * names the four moments the app is allowed to mark; reaching past it is how
 * the taxonomy came apart the first time.
 */
describe("haptics", () => {
  it("are only ever asked for by name", () => {
    const direct = sourceFiles("src")
      .filter((path) => !path.endsWith("core/ui/haptics.ts"))
      .filter((path) => readFileSync(path, "utf8").includes("expo-haptics"));

    expect(direct).toEqual([]);
  });
});
