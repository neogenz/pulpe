import { readFileSync } from "@/core/testing/source-files";

describe("phase 11 background localization", () => {
  it("reschedules the stable reminder only after a confirmed locale write", () => {
    const language = readFileSync(
      "src/app/(main)/settings/language.tsx",
      "utf8",
    );
    const confirmed = language.slice(language.indexOf("onConfirmed:"));
    expect(confirmed).toContain("readRemindersEnabled()");
    expect(confirmed).toContain(
      "scheduleMonthlyReminder(confirmedSettings.payDayOfMonth ?? null)",
    );
  });

  it("registers the normalized locale without a device locale", () => {
    const analytics = readFileSync(
      "src/core/observability/analytics.ts",
      "utf8",
    );
    expect(analytics).toContain("locale: useLocaleStore.getState().locale");
    expect(analytics).not.toContain("getLocales(");
  });
});
