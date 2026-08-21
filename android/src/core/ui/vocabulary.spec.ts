import { i18n, translate } from "@/core/i18n/i18n";

import { recurrenceLabel, recurrenceOptions } from "./vocabulary";

describe("localized product vocabulary", () => {
  it.each([
    ["fr", ["Récurrent", "Prévu"]],
    ["en", ["Recurring", "Planned"]],
    ["de", ["Regelmässig", "Geplant"]],
    ["it", ["Ricorrente", "Pianificato"]],
  ])(
    "resolves recurrence labels from the live %s catalog",
    (locale, expected) => {
      i18n.locale = locale;
      expect(recurrenceOptions(translate).map(({ label }) => label)).toEqual(
        expected,
      );
    },
  );

  it("never changes the recurrence enum", () => {
    i18n.locale = "en";
    expect(recurrenceOptions(translate).map(({ value }) => value)).toEqual([
      "fixed",
      "one_off",
    ]);
    expect(recurrenceLabel(translate, "one_off")).toBe("Planned");
  });
});
