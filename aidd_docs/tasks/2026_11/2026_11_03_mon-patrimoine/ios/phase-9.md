---
status: pending
---

# Instruction: Value suggestions and refresh on return

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete. Files created by an earlier phase of this plan are marked `modify (phase n)`.

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Features/
    │   │   └── NetWorth/
    │   │       ├── NetWorthView.swift modify (phase 3)
    │   │       ├── NetWorthAssetRow.swift modify (phase 3)
    │   │       ├── NetWorthSections.swift modify (phase 3)
    │   │       └── NetWorthSuggestionRow.swift ✅
    │   └── Resources/
    │       └── Localizable.xcstrings ✏️
    └── PulpeTests/
        └── Features/
            └── NetWorth/
                └── NetWorthSectionsTests.swift modify (phase 3)
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Phase 8 state: Épargne prévision of 500 linked to « Livret » (3 000 EUR), Dépense of 400 linked to « Leasing » (8 000 CHF), both unchecked | No suggestion on the screen | simulator |
| Happy path | Point both prévisions in the current month, go back to « Objectifs » → « Mon patrimoine » | Livret « Je propose 3 500 € », detail « 500 € d'épargne pointée depuis la dernière valeur »; Leasing « Je propose 7 600 CHF », detail repaid | simulator |
| Happy path | Appliquer on Livret | One `POST /v1/assets/snapshots` with the API `proposedValue`; row 3 500 €, aged today, no suggestion | simulator |
| Happy path | Écarter on Leasing | One `POST /v1/assets/:id/dismiss-suggestion`; suggestion gone, value unchanged | simulator |
| Edge case  | Point another linked prévision after Écarter, return to the screen | The suggestion comes back | simulator |
| Edge case  | Switch to another tab and back to « Objectifs » while the page is pushed | `GET /v1/assets` re-runs; if `.task` does not re-run on tab return, the `onAppear` fallback in task 2 does | simulator |
| Edge case  | Archived asset whose payload carries a suggestion | No suggestion shown | cli |
| Edge case  | Own asset with negative `delta` | Detail « … de revenu tiré … », amount without sign | cli |
| Edge case  | Apply fails | Error toast; refetch; suggestion still offered | simulator |
| Teardown   | Unpoint, delete the test prévisions and assets, remove the plist key | Baseline restored | simulator |

## Tasks to do

### `1)` Suggestion presentation

> The proposed value and why, as the web row says it.

1. `NetWorthSections`: `visibleSuggestion(of:)` (`nil` when archived), `suggestionDetailKey(of:)` (owe → repaid; own with `delta < 0` → drawn; else saved) and the unsigned delta magnitude for the wording, ported from `frontend/projects/webapp/src/app/feature/net-worth/components/net-worth-asset-row.ts:259-274`; the proposed value is the API `proposedValue`, never recomputed.
2. `NetWorthSuggestionRow`: « Je propose <proposedValue> », detail, Écarter (secondary) and Appliquer (primary), amounts through `asCurrency(asset.currency)` with `.sensitiveAmount()`; shown under the asset row.
3. Appliquer calls `AssetStore.recordSnapshots([.init(assetId:, value: suggestion.proposedValue)])`, Écarter `dismissSuggestion(id:)`; errors through `ToastManager`.
4. `NetWorthSectionsTests`: archived hides, the three detail keys, unsigned magnitude.
5. Copy from `netWorth.suggestion.*` with `de`, `en`, `it`.

### `2)` Revalidate on each appearance

> Pointing elsewhere never notifies the asset store (`CurrentMonthStore.swift:741`), so the screen rereads.

1. `NetWorthView` swaps `.task { loadIfNeeded() }` for `.task { await store.forceRefresh() }`, keeping the cached figures on screen while it reloads (no loading state when `netWorth != nil`).
2. Check on the simulator that switching tabs and back re-runs it; if it does not, add `.onAppear` with a `Task` guarded by the store's in-flight load. Record the observed behaviour in the commit body.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | `NetWorthSectionsTests` pass with a non-zero executed count; Appliquer and Écarter behave per the Test Scope |
| 2    | Pointing a linked prévision then returning to the screen shows the suggestion without pull-to-refresh |
| 2    | `pnpm test:lexicon`, `swiftlint lint --strict` and `xcodebuild build -scheme PulpeLocal -configuration Local` pass |
