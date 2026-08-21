import { i18n, translate } from "@/core/i18n/i18n";

import { chargeSuggestions, savingSuggestions } from "./suggestions";

function localizedSuggestions() {
  const chargeNames = {
    groceries: translate("onboarding.suggestions.groceries"),
    diningOut: translate("onboarding.suggestions.diningOut"),
    leisureSport: translate("onboarding.suggestions.leisureSport"),
  };
  const savingNames = {
    saving: translate("onboarding.suggestions.saving"),
    retirement: translate("onboarding.suggestions.retirement"),
    retirementSwiss: translate("onboarding.suggestions.retirementSwiss"),
  };
  return { chargeNames, savingNames };
}

it.each([
  [
    "fr",
    "Courses / alimentation",
    "Épargne",
    "3ème pilier",
    "Épargne retraite",
  ],
  ["en", "Groceries / food", "Savings", "Third pillar", "Retirement savings"],
  ["de", "Einkauf / Essen", "Sparen", "Säule 3a", "Altersvorsorge"],
  ["it", "Spesa / alimentari", "Risparmio", "Terzo pilastro", "Previdenza"],
])(
  "localizes suggestion labels in %s",
  (locale, charge, saving, pillar, retirement) => {
    i18n.locale = locale;
    const names = localizedSuggestions();

    expect(chargeSuggestions(names.chargeNames)[0]?.name).toBe(charge);
    expect(
      savingSuggestions("CHF", names.savingNames).map((it) => it.name),
    ).toEqual([saving, pillar]);
    expect(savingSuggestions("EUR", names.savingNames)[1]?.name).toBe(
      retirement,
    );
  },
);

it("keeps suggestion domain values stable across currencies", () => {
  const names = localizedSuggestions();
  const values = [
    ...chargeSuggestions(names.chargeNames),
    ...savingSuggestions("CHF", names.savingNames),
    ...savingSuggestions("EUR", names.savingNames),
  ].map(({ id, amount, type, expenseType, isRecurring }) => [
    id,
    amount,
    type,
    expenseType,
    isRecurring,
  ]);

  expect(values.map(([id]) => id)).toEqual([
    "f1a1e501-c0a5-4000-a000-000000000001",
    "f1a1e501-c0a5-4000-a000-000000000002",
    "f1a1e501-c0a5-4000-a000-000000000003",
    "f1a1e501-c0a5-4000-a000-000000000004",
    "f1a1e501-c0a5-4000-a000-000000000005",
    "f1a1e501-c0a5-4000-a000-000000000004",
    "f1a1e501-c0a5-4000-a000-000000000005",
  ]);
  expect(values.map((value) => value.slice(1))).toEqual([
    [600, "expense", "fixed", true],
    [150, "expense", "fixed", true],
    [100, "expense", "fixed", true],
    [500, "saving", "fixed", true],
    [587, "saving", "fixed", true],
    [500, "saving", "fixed", true],
    [587, "saving", "fixed", true],
  ]);
});
