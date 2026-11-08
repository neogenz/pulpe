# Mon patrimoine on iOS

## Target

On iOS, in the V2 visual language, a user with the `net_worth` flag does everything the web « Mon patrimoine » feature (PUL-366) offers, against the same API and with the same figures.

## Hard constraints

- iOS client only: the backend, the database and the shared contract stay unchanged.
- Every money figure shown (converted values, category subtotals, gross, debts, net, proposed values) comes from the API; the app computes none.
- Without the `net_worth` flag, no entry point, field, row or picker of the feature appears anywhere, and existing flows behave exactly as before.
- The tab bar keeps its four tabs (`ios/DESIGN.md`, Navigation).
- Product copy is French, in « je », with the project vocabulary; the word « transaction » never shows.
- Visual values come from the design tokens and the shared components, never literal numbers or colours.
- Amounts follow the asset's currency formatting rules already used in the app; the currency is never concatenated by hand.
- Logging out leaves no asset of the previous account visible to the next one.
- No analytics event carries an amount or a label.

## Non-goals

- Evolution curve of the net worth and a date picker on the breakdown.
- Market quotes for investments (values stay manual).
- Removing the `net_worth` flag.
- Android.
- Changing the web feature.

## Done-when

- I create, rename, recategorise, archive and delete an asset or a debt in CHF or EUR, in a free category; a new category can be created from a suggested starter name.
- I rename, create and delete categories; deleting a category that still holds an asset is refused with a message, and the category stays.
- Updating an asset's value records a snapshot dated today, and the row shows its age.
- The screen shows net worth as the hero figure, with gross and debts, in the base currency, a note that foreign values use today's rate, and a notice when a total leaves an asset out.
- A breakdown diagram shows assets → categories → gross → debts and net worth, following the same mapping rules as the web, overdraft and debts-above-gross included; it is absent when nothing is owned.
- With no asset, an empty state offers a single « Ajouter un avoir » action.
- Archived assets leave the list, totals and breakdown, and appear under a separate « archivés » section with their last value.
- The account reconciliation opens with one row per in-Pulpe asset of the budget currency; completing it records the typed balances as snapshots, and dismissing it records nothing. With the flag off it opens as today.
- An Épargne prévision can be linked to an own asset and a Dépense to a debt, on prévisions and on template lines; the link survives edits that don't touch it.
- An asset whose checked linked prévisions moved it shows a proposed value; Appliquer records it as a snapshot, Écarter hides it until the next linked movement; checking a prévision elsewhere shows up on return to the screen.
- A Revenu can be created as drawn from an own asset; the edit form shows that origin read-only.
- API errors of the feature show their French message, not a generic one.

## Open Questions

None.

## Context

- Ticket: PUL-366. Web plan, rules and phase decisions: [`../plan.md`](../plan.md), [`../phase-3.md`](../phase-3.md) to [`../phase-7.md`](../phase-7.md).
- Business rules: `docs/BUSINESS_RULES.md`, Patrimoine section.
- Entry point placement decided in auto mode: inside the « Objectifs » tab, since the web places it right after « Objectifs d'épargne » and the tab bar stays at four.
