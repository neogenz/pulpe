---
status: pending
---

# Instruction: Web: step 2, suggestions, gaps below and matched

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── frontend/
    ├── e2e/tests/features/
    │   └── account-reconciliation.spec.ts ✏️
    └── projects/webapp/
        ├── public/i18n/
        │   ├── fr.json ✏️
        │   ├── en.json ✏️
        │   ├── de.json ✏️
        │   └── it.json ✏️
        └── src/app/
            ├── core/reconciliation/
            │   ├── reconciliation-api.ts ✅
            │   └── reconciliation-api.spec.ts ✅
            ├── feature/current-month/
            │   ├── current-month.ts ✏️
            │   └── current-month.spec.ts ✏️
            ├── feature/budget/budget-details/
            │   ├── budget-details-page.ts ✏️
            │   └── budget-details-page.spec.ts ✏️
            └── pattern/reconcile-accounts/
                ├── reconcile-compare-step.ts ✅
                ├── reconcile-compare-step.spec.ts ✅
                ├── reconcile-accounts-dialog.ts ✏️
                ├── reconcile-accounts-dialog.html ✏️
                ├── reconcile-accounts-dialog.scss ✏️
                └── reconcile-accounts-dialog.spec.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Demo user, current month realized 1 050.00, unchecked « Assurance » budget line 100, « Essence » 60, previous month « Pharmacie » 40 unchecked; phases 3-4 deployed locally | Step 1 ready | browser |
| Happy path | Type 950, « Comparer » | Title « Tes comptes ont 100.00 de moins que Pulpe »; Assurance « Prévue ce mois » with 100.00 highlighted, Essence, Pharmacie « Mois dernier » | browser |
| Happy path | Check Essence | Title 40.00; 1 050.00 struck through next to 990.00; bar « 60.00 trouvés », no « à trouver » text; Pharmacie highlighted | browser |
| Happy path | Check Pharmacie | Matched: title « Pareil des deux côtés » with no sentence under it, « Encore prévu », « À dépenser ce mois », [Terminer]; completion sent once; `account_reconciliation_completed` `none` | browser + api |
| Edge case | « Aucune dépense ne correspond » with 2.40 left | Small gap with the café row, [Noter une dépense de 2.40], « Disponible : 900.00 → 897.60 » | browser |
| Edge case | 120.00 left, no candidate | Large gap question, [Oui, noter une dépense de 120.00] writes « Écart avec mes comptes » once, even on a double tap | browser + api |
| Edge case | A « Je dois » row and gap below | « Coche les achats faits avec ta carte. » and [Retirer « Je dois 800 »] recomputes | browser |
| Edge case | Context request fails | Step 2 shows an error with [Réessayer]; nothing written; back keeps the typed amounts | browser |
| Edge case | Phone width | Footer buttons stay in view on 390×664 | browser |
| Teardown | Delete the noted movement, uncheck the checked items | Demo month back to setup | browser |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1) ←  Comparer avec mes comptes ? │
│ (2) Étape 2 sur 2                │
│     Tes comptes ont 100.00 de    │
│     moins que Pulpe              │
│ ┌──────────────────────────────┐ │
│ │ (3) Sur tes comptes   950.00 │ │
│ │ Dans Pulpe, déjà coché 1 050.00│
│ │ (4) ▓▓▓▓░░ 60.00 trouvés     │ │
│ └──────────────────────────────┘ │
│ (5) Coche les dépenses que tu…   │
│ ┌──────────────────────────────┐ │
│ │ (6) ☐ Assurance       100.00 │ │
│ │       Prévue ce mois         │ │
│ └──────────────────────────────┘ │
│ (7) Voir les 42 autres à cocher  │
│ (8) [ Aucune dépense ne corr. ]  │
│     Laisser comme ça             │
└──────────────────────────────────┘
```

1. Back to step 1, title, « ? ».
2. Step label and the verdict as title.
3. The two figures; the Pulpe one struck through and replaced after a check.
4. Progress bar, only after a check in this comparison.
5. Lead sentence, card wording when a « Je dois » row exists.
6. Up to 3 suggestions, 64px rows, second line per spec.md §4.2.
7. Opens the existing list of items to check.
8. Dismiss suggestions, then leave as is.

## Tasks to do

### `1)` Reconciliation API client

> The dialog reads the context and records completion through typed calls.

1. `reconciliation-api.ts`: `getContext(budgetId)` and `updateState(body)` validated by the shared schemas.

### `2)` Compare step: figures and suggestions

> Step 2 of spec.md §4.1-4.2 in its own component.

1. `reconcile-compare-step.ts`: figures from `comparedFigure`, verdict title, suggestions from `rankedPointingCandidates` with prior items, partial-check display, « Je dois » box, footer.
2. The callers' point action checks a movement or a budget line of any of the three months (`current-month.ts`, `budget-details-page.ts`), then the dialog refetches the context.
3. Step 2 waits for `getContext`; a failure shows the error of spec.md §4.1 with [Réessayer] and offers no write.
4. Amounts in tabular figures and never split across two lines, spec.md §5.

### `3)` Gaps below and the noted entry

> Small and large gaps end on one written entry or nothing.

1. Screens small gap and large gap from `comparisonScreen`, « Disponible : a → b » from `availableAfterNote`.
2. The entry is named « Écart avec mes comptes » (translated); the editable label field is removed.

### `4)` Matched and completion

> The person sees why the balance and the available amount differ, and the comparison counts as done.

1. Matched screen with `matchedBreakdown` lines and [Terminer].
2. Every exit of spec.md §4.5 sends `updateState({ completed: true })` once and emits the existing completion event.
3. Remove the old « realized » and « verdict » steps and their strings.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | API spec: parses a valid context, rejects a malformed one |
| 2 | Compare step spec covers the happy path rows and the partial check numbers above; a failed context shows the error and no write button; no amount wraps at 390×664 |
| 3 | Dialog spec: small and large gaps, one write on double tap, name « Écart avec mes comptes » |
| 4 | Dialog spec: completion sent once per comparison; e2e passes at 1280×800 and 390×664; `ng build` passes |
