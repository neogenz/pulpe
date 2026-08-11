import type { SupportedCurrency } from "pulpe-shared";

import type { OnboardingTransaction } from "./onboarding-transaction";

/**
 * The suggestion chips, mirroring `OnboardingState+Suggestions.swift` down to
 * the identifiers: a chip toggled on keeps the same identity across amount
 * edits and draft restores, and a hand-added line can never collide with one
 * even when the user types the same name.
 */
const CHARGE_SUGGESTIONS: readonly OnboardingTransaction[] = [
  suggestion(
    "f1a1e501-c0a5-4000-a000-000000000001",
    600,
    "expense",
    "Courses / alimentation",
  ),
  suggestion(
    "f1a1e501-c0a5-4000-a000-000000000002",
    150,
    "expense",
    "Restaurants & sorties",
  ),
  suggestion(
    "f1a1e501-c0a5-4000-a000-000000000003",
    100,
    "expense",
    "Loisirs & sport",
  ),
];

const SAVINGS_ID = "f1a1e501-c0a5-4000-a000-000000000004";
const RETIREMENT_ID = "f1a1e501-c0a5-4000-a000-000000000005";

export function chargeSuggestions(): readonly OnboardingTransaction[] {
  return CHARGE_SUGGESTIONS;
}

/**
 * Only the retirement chip's label follows the currency — the id and the amount
 * do not. A chip toggled on in CHF therefore stays on when the user switches to
 * EUR: the line it added keeps its original label, and only the chip relabels.
 */
export function savingSuggestions(
  currency: SupportedCurrency,
): readonly OnboardingTransaction[] {
  return [
    suggestion(SAVINGS_ID, 500, "saving", "Épargne"),
    suggestion(
      RETIREMENT_ID,
      587,
      "saving",
      currency === "CHF" ? "3ème pilier" : "Épargne retraite",
    ),
  ];
}

const SUGGESTION_IDS: ReadonlySet<string> = new Set([
  ...CHARGE_SUGGESTIONS.map((it) => it.id),
  SAVINGS_ID,
  RETIREMENT_ID,
]);

/** Whether a line came from a chip rather than from the add-expense sheet. */
export function isSuggestion(transaction: OnboardingTransaction): boolean {
  return SUGGESTION_IDS.has(transaction.id);
}

function suggestion(
  id: string,
  amount: number,
  kind: OnboardingTransaction["type"],
  name: string,
): OnboardingTransaction {
  return {
    id,
    amount,
    type: kind,
    name,
    expenseType: "fixed",
    isRecurring: true,
  };
}
