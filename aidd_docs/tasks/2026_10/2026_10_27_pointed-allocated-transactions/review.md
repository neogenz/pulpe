# Review: Pointed allocated transactions under the "Pointé" filter

- Rounds: 1
- Started: 2026-10-27

## Round 1 · r-7c3e

- Date: 2026-10-27
- By: Maxime De Sogus
- Diff: `main...ccba3cf29` plus the working tree
- Axes: code, functional, relevancy
- Verdict: approve
- Score: 5/6 met, 0 unmet, 1 unverified at runtime, 0 out of the diff

### Criteria

- [x] Under "Pointé", pointed transactions of an envelope still to point are listed — `ios/.../State/FiltersStore.swift:223`, `android/.../budget-details-selectors.ts:139`
- [x] Transactions of a pointed envelope stay out (its row stands for them) — `ios/.../BudgetDetailsProjector+Sections.swift:73`, `android/.../budget-details-selectors.ts:152`
- [x] The list is empty under "À pointer" and "Tout voir" — `ios/.../State/FiltersStore.swift:230`, `android/.../budget-details-selectors.ts:144`
- [x] Type filter (by envelope kind) and search (transaction name, envelope name, amount) apply — `ios/.../State/FiltersStore.swift:236`, `android/.../budget-details-selectors.ts:153`
- [x] Tapping a row opens its envelope; the disc toggles the transaction — `ios/.../BudgetDetailsView+MovementLists.swift:22`, `android/src/app/(main)/budget/[id].tsx:563`
- Unverified at runtime: each row reads as belonging to an envelope (↳ + envelope name under the date, own a11y wording) — a device run would show the rendered row and VoiceOver/TalkBack output

### Findings

- `ios/Pulpe/Features/Budgets/BudgetDetails/Projection/BudgetDetailsScreenState.swift:196` : `FreeTransactionItem` now also carries allocated rows (`envelopeName`), so its name no longer says what it holds → rename to `TransactionItem` in a dedicated refactor — 🟢 minor, code-health
- `ios/Pulpe/Features/Budgets/BudgetDetails/Projection/BudgetDetailsProjector+Sections.swift:73` : the open-envelope selection (`isEffectivelyChecked`, planned savings withdrawals included) is only covered through `FiltersStoreTests` inputs, not through the projector → add a projector test with a planned withdrawal envelope if this path regresses — 🟢 minor, code-health
