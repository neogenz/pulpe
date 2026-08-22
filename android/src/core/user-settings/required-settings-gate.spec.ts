const { readFileSync } = jest.requireActual<{
  readFileSync(path: string, encoding: "utf8"): string;
}>("node:fs");

const gate = readFileSync(
  "src/core/user-settings/required-settings-gate.tsx",
  "utf8",
);
const mainLayout = readFileSync("src/app/(main)/_layout.tsx", "utf8");

describe("required user settings gate", () => {
  it("keeps cached settings usable when a background refresh fails", () => {
    expect(gate.indexOf("settings.data !== undefined")).toBeLessThan(
      gate.indexOf("settings.isError"),
    );
  });

  it("blocks authenticated screens until settings are available", () => {
    expect(mainLayout).toContain("<RequiredSettingsGate>");
    expect(mainLayout.indexOf("<RequiredSettingsGate>")).toBeLessThan(
      mainLayout.indexOf("<Stack"),
    );
  });
});
