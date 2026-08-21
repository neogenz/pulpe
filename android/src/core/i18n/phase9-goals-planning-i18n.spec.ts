import { readFileSync } from "@/core/testing/source-files";
import { i18n, translate } from "./i18n";

describe("phase 9 savings goal planning localization", () => {
  it.each([
    ["fr", "Simuler ton plan", "Tout supprimer"],
    ["en", "Simulate your plan", "Delete everything"],
    ["de", "Plan simulieren", "Alles löschen"],
    ["it", "Simula il tuo piano", "Elimina tutto"],
  ])(
    "resolves planning and destructive copy in %s",
    (locale, title, action) => {
      i18n.locale = locale;
      expect(translate("goals.simulator.title")).toBe(title);
      expect(
        translate("goals.deletion.confirm.goal_forecasts_and_transactions"),
      ).toBe(action);
      expect(translate("goals.recap.intro", { count: 2 })).not.toContain("%{");
    },
  );

  it("keeps destructive sheets non-dismissable during mutations", () => {
    const deletion = readFileSync(
      "src/features/savings-goals/components/goal-deletion-sheet.tsx",
      "utf8",
    );
    const stop = readFileSync(
      "src/features/savings-goals/components/goal-generation-stop-sheet.tsx",
      "utf8",
    );
    expect(deletion).toContain("isBusy={remove.isPending}");
    expect(stop).toContain("isBusy={stop.isPending}");
  });
});
