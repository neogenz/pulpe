const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

const template = readFileSync("src/app/(main)/template/[id].tsx", "utf8");
const goal = readFileSync("src/app/(main)/goal/[id].tsx", "utf8");
const systemGate = readFileSync(
  "src/core/system/system-gate-screen.tsx",
  "utf8",
);

describe("detail query states", () => {
  it("gates required query failures before missing-data empty states", () => {
    expect(template.indexOf("template.isError || lines.isError")).toBeLessThan(
      template.indexOf("template.data === undefined"),
    );
    expect(goal.indexOf("goal.isError || progress.isError")).toBeLessThan(
      goal.indexOf("goal.data === undefined"),
    );
    expect(template).toContain("<InlineQueryError");
    expect(goal).toContain("<InlineQueryError");
  });

  it("keeps dependent actions unavailable until optional impact data loads", () => {
    expect(template).toContain("disabled={!isUsageReady}");
    expect(goal).toContain("disabled={!areFutureLinesReady}");
  });

  it("stops the maintenance animation when reduced motion is requested", () => {
    expect(systemGate).toContain("useReducedMotion()");
    expect(systemGate).toContain("autoPlay={!shouldReduceMotion}");
    expect(systemGate).toContain("loop={!shouldReduceMotion}");
  });
});
