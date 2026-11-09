---
status: pending
---

# Instruction: « Mon patrimoine » screen and Objectifs entry

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── docs/
│   └── BUSINESS_RULES.md ✏️
└── ios/
    ├── DESIGN.md ✏️
    ├── Pulpe/
    │   ├── App/
    │   │   ├── AppState+Navigation.swift ✏️
    │   │   └── MainTabView.swift ✏️
    │   ├── Features/
    │   │   ├── SavingsGoals/
    │   │   │   └── SavingsGoalsListView.swift ✏️
    │   │   └── NetWorth/
    │   │       ├── NetWorthView.swift ✅
    │   │       ├── NetWorthHero.swift ✅
    │   │       ├── NetWorthSections.swift ✅
    │   │       └── NetWorthAssetRow.swift ✅
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── NetWorth/
                └── NetWorthSectionsTests.swift ✅
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | `cd backend-nest && supabase start` from the main repo, backend running, PulpeLocal built with `-derivedDataPath <scratchpad>/dd` and installed on the interactive simulator; flag forced: app terminated, `PlistBuddy -c "Add :pulpe.feature_flags.net_worth bool true"` on the sandboxed `Library/Preferences/app.pulpe.ios.plist` (after `killall -9 cfprefsd`), relaunch; sign in with the demo account of `backend-nest/supabase/seed.sql` | « Objectifs » shows a « Mon patrimoine » row | simulator |
| Happy path | With assets created on the web for the same account (UBS 12 000 CHF in Comptes, Livret 3 000 EUR in Épargne, Leasing 8 000 CHF owed), open « Mon patrimoine » | Net worth hero, « Ce que j'ai » and « Ce que je dois » equal the web page; sections Comptes, Épargne, Ce que je dois with the API subtotals; Livret shows its EUR value and its CHF conversion; each row shows its age | simulator |
| Edge case  | No asset | One empty state; no section, no hero | simulator |
| Edge case  | An archived asset | Absent from sections and totals; listed with its last value under « Voir les archives (1) » | simulator |
| Edge case  | `incomplete: true` (unit fixture) | Foreign row shows « Hors total » and no conversion; the hero carries the notice | cli |
| Edge case  | An `own` asset at -300 | Listed in « Ce que je dois » with « Découvert », not in its category | cli |
| Edge case  | Flag removed from the plist, relaunch | No entry in « Objectifs »; no `GET /v1/assets` in the backend log | simulator |
| Edge case  | Amounts hidden (eye toggle) | Every figure of the screen is blurred | simulator |
| Teardown   | Remove the plist key, relaunch | Baseline restored | simulator |

## Wireframe

```txt
┌──────────────────────────────────────┐
│ (1) ‹ Objectifs     Mon patrimoine    │
├──────────────────────────────────────┤
│ (2) Ma fortune nette                  │
│     19 820 CHF                        │
│     Ce que j'ai 28 820 · Je dois 8 000│
│     taux du jour · [notice incomplet] │
├──────────────────────────────────────┤
│ (3) [phase 6: répartition]            │
├──────────────────────────────────────┤
│ (4) Comptes               12 000 CHF  │
│  ┌────────────────────────────────┐  │
│  │ (5) Compte UBS [Dans Pulpe]     │  │
│  │     mis à jour aujourd'hui      │  │
│  │                    12 000 CHF   │  │
│  └────────────────────────────────┘  │
│ (4) Épargne                2 820 CHF │
│  │ (5) Livret  3 000 € ≈ 2 820 CHF │  │
├──────────────────────────────────────┤
│ (6) Ce que je dois         8 000 CHF │
│  │ (5) Leasing          8 000 CHF   │  │
├──────────────────────────────────────┤
│ (7) Voir les archives (1)        ▾   │
└──────────────────────────────────────┘
```

1. Pushed page title, back to « Objectifs »; the add action and menu arrive in phase 4.
2. Hero: net worth as the dominant figure (warning amber tone when negative, never error red, per `docs/BUSINESS_RULES.md` Patrimoine, with `negativeNote` under it), gross and debts beside it, a note that foreign values use today's rate when an active asset is not in the base currency, an `InfoBanner` when `incomplete`.
3. Slot for the breakdown diagram of phase 6.
4. Category section: one per category holding an active non-negative `own` asset, header with the API `total`.
5. Asset row: name, `PulpeChip` badges (« Dans Pulpe », « Découvert », « Hors total »), value in its currency, conversion when foreign, age of the last value.
6. Debts section: every active `owe` asset and every active `own` asset below zero, header with `totals.debts`.
7. Archived: `CollapsibleSection` listing archived assets with their last value, outside every total.

## Tasks to do

### `1)` Group without computing

> Sections are a pure projection of the API response.

1. `NetWorthSections.swift`: from `NetWorth`, build ordered category sections (API order, only categories holding an active `own` asset with `latestValue >= 0`, header `category.total`), the debts section (active `owe`, or `own` with `latestValue < 0`, header `totals.debts`), and the archived list. No sum, no conversion.
2. Row presentation helpers: badges, whether to show the conversion (`currency != baseCurrency` and `convertedValue != nil`), the age label through `RelativeDateTimeFormatter` in the app UI locale (`AppLocale`), « aujourd'hui » for today.
3. `NetWorthSectionsTests`: grouping, overdraft to debts, archived excluded, empty category hidden, `incomplete` row, age labels.

### `2)` Screen

> Read-only page on the V2 grammar.

1. `NetWorthView`: content enum `loading | failed | empty | loaded` switched in `body` (ios-architecture rule), `ErrorView` retry on failure, `PulpeEmptyState` (title, one sentence, no action yet), `ScrollView` with `PageHeader`-style hero, sections in `pulpeSurfaceCard` rows like `SavingsGoalsListView`, `.refreshable { await store.forceRefresh() }`, `.task { await store.loadIfNeeded() }`.
2. `NetWorthHero` and `NetWorthAssetRow`: amounts through `asCurrency(_:)` / `asCompactCurrency(_:)` with `monospacedDigit()` and `.sensitiveAmount()`; tokens only; asset names never in analytics.
3. Copy in « je » from `netWorth.*` of the web i18n files (heroTitle, gross, debts, negativeNote, incompleteNotice, excluded, inPulpe, overdraft, updated, updatedDebt, showArchived, hideArchived, archivedTitle, emptyTitle, emptyMessage, loadError), with `de`, `en`, `it` in `Localizable.xcstrings`. `incompleteNotice` takes its currency and asset names from the assets whose `convertedValue` is `nil` (names only, no amount). The web `fxNote` prints a rate the API does not return, so iOS gets one new key « Les valeurs en devise étrangère sont converties au taux du jour. » translated in the three languages.

### `3)` Entry in « Objectifs »

> Superseded on 2026-11-09 (see the plan's Decisions): the entry is now the flagged Patrimoine tab (`NetWorthTab` in `MainTabView`), and this row was removed. P3.3 traces against the tab.

> Reach the page from the Objectifs tab when the flag is on, without a fifth tab.

1. `NetWorthDestination: Hashable { case overview }` in `AppState+Navigation.swift`.
2. `SectionStackDestinations` in `MainTabView.swift` resolves it to `NetWorthView()`.
3. `SavingsGoalsListView`: when `FeatureFlagsStore.isNetWorthEnabled`, a `ContextLinkRow` « Mon patrimoine » (icon `building.columns`, `pulpePrimary`) inside a `NavigationLink(value: NetWorthDestination.overview)`, after the « Nouvel objectif » button in the list and after the presets in the empty state. In the Duo layout the page opens in the detail pane, like a goal.
4. No harness change: `SavingsGoalIntervalUITestHarness.swift:386-416` renders goal detail, history and template rows, never the goals list; the two harnesses that render budget sheets got both stores in phase 2.

### `4)` Docs

> The design and business docs describe the iOS surface.

1. `ios/DESIGN.md` Navigation: « Mon patrimoine » is a pushed page from the Objectifs list, never a tab.
2. `docs/BUSINESS_RULES.md` lines 55 and 61: « le web » becomes « les clients ».

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `NetWorthSectionsTests` pass; no `+`, `-` or `reduce` on an amount in `Features/NetWorth/` |
| 2    | The Test Scope happy path shows the same totals and subtotals as the web for the same account; `pnpm test:lexicon` passes |
| 3    | With the flag on the row opens the page; with it off the row is absent and the asset endpoint is never called |
| 4    | `xcodegen generate --use-cache`, `swiftlint lint --strict` and `xcodebuild test ... -only-testing:PulpeTests/NetWorthSectionsTests` (non-zero executed count) pass; `xcodebuild build -scheme PulpeLocal -configuration Local` passes |
