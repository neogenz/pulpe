---
status: done
---

# Instruction: Value suggestions from checked prévisions

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete. Files created by an earlier phase of this plan are marked `modify (phase n)`.

```txt
.
├── docs/
│   └── BUSINESS_RULES.md ✏️
├── shared/
│   └── schemas.ts ✏️
├── backend-nest/
│   ├── supabase/
│   │   └── migrations/
│   │       └── 20261103140000_asset_suggestion_dismissal.sql ✅
│   └── src/
│       ├── types/
│       │   └── database.types.ts ✏️
│       └── modules/
│           └── asset/
│               ├── asset.module.ts                          modify (phase 2)
│               ├── domain/
│               │   ├── asset.formulas.ts                    modify (phase 2)
│               │   ├── asset.formulas.spec.ts               modify (phase 2)
│               │   └── ports/
│               │       └── asset-repository.port.ts         modify (phase 2)
│               ├── application/
│               │   ├── get-net-worth.use-case.ts            modify (phase 2)
│               │   ├── get-net-worth.use-case.spec.ts       modify (phase 2)
│               │   └── dismiss-asset-suggestion.use-case.ts ✅
│               └── infrastructure/
│                   ├── http/
│                   │   └── asset.controller.ts              modify (phase 2)
│                   └── persistence/
│                       ├── supabase-asset.repository.ts     modify (phase 2)
│                       └── supabase-asset.repository.spec.ts modify (phase 2)
└── frontend/
    └── projects/
        └── webapp/
            ├── public/
            │   └── i18n/
            │       ├── fr.json ✏️
            │       ├── en.json ✏️
            │       ├── de.json ✏️
            │       └── it.json ✏️
            └── src/
                └── app/
                    ├── core/
                    │   └── asset/
                    │       ├── asset-api.ts                 modify (phase 3)
                    │       └── asset-api.spec.ts            modify (phase 3)
                    └── feature/
                        └── net-worth/
                            ├── net-worth-page.ts            modify (phase 3)
                            ├── net-worth-page.spec.ts       modify (phase 3)
                            └── services/
                                └── net-worth-store.ts       modify (phase 3)
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Flag forced through the `pulpe-dev-feature-flags` override; « Livret » at 3 000 CHF with a snapshot yesterday; « Épargne mensuelle » 500 linked to it; « Leasing » at 8 000 owe with « Mensualité leasing » 400 linked | « Mon patrimoine » open | browser |
| Happy path | Check « Épargne mensuelle » on the budget page, open « Mon patrimoine » | « Livret » row proposes 3 500 CHF with « +500 d'épargne pointée » and Appliquer / Écarter | browser |
| Happy path | Appliquer | New snapshot 3 500; suggestion gone; totals and Sankey follow | browser |
| Happy path | Check « Mensualité leasing » | « Leasing » proposes 7 600 CHF | browser |
| Edge case  | Écarter « +500 », then check another prévision of 200 linked to « Livret » | Suggestion comes back with 3 200 CHF: only the movement checked after the dismissal counts | browser |
| Edge case  | Écarter, check nothing new | Suggestion stays hidden after reload | browser |
| Edge case  | Uncheck the prévision before applying | Suggestion gone | browser |
| Edge case  | An unlinked Dépense is checked; a Dépense can never link an own asset (phase 5 trigger) | No suggestion on any own asset | api |
| Edge case  | EUR asset linked to a CHF prévision | Delta converted at today's rate; no rate means no suggestion | api |
| Edge case  | Archived asset with checked linked prévisions | No suggestion | api |
| Edge case  | More than 1000 checked linked prévisions | Delta counts all of them | api |
| Teardown   | `bun run supabase:reset` | Seed restored | system |

## Tasks to do

### `1)` Store the dismissal

> One timestamp per asset hides a suggestion until the next linked movement.

1. Expand migration: `ALTER TABLE asset ADD COLUMN suggestion_dismissed_at timestamptz`.
2. `bun run generate-types:local`, then `bun run format`.

### `2)` Compute the suggestion on read

> Each active asset carries a proposed value when checked linked prévisions moved it.

1. Repository reads checked `budget_line` rows with an `asset_id` of the user, `checked_at` after `max(lastSnapshotAt, suggestion_dismissed_at)`, through `fetchAllPages`, decrypting `amount`.
2. Formula in `asset.formulas.ts`: saving on own adds, income on own subtracts, expense on a debt subtracts what remains due; converted into the asset currency with the rate already fetched for totals; no rate means no suggestion.
3. No counted line means `suggestion: null`; dismissed movements are never counted again.
4. `assetSchema` gains `suggestion: { delta, proposedValue } | null` in `shared/schemas.ts`.
5. Formula and use-case specs per the Test Scope.

### `3)` Accept and dismiss

> Apply writes a snapshot; dismiss records the timestamp.

1. Apply reuses `POST /v1/assets/snapshots` with `proposedValue`.
2. `dismiss-asset-suggestion.use-case.ts` and `POST /v1/assets/:id/dismiss-suggestion`, ownership checked.

### `4)` Web suggestion

> The asset row offers the proposed value.

1. Row line « Pulpe propose … » with Appliquer and Écarter in `net-worth-page.ts`; store mutations invalidate `['assets']`.
2. `asset-api.ts` invalidates its cache when the budget cache version changes, like `savings-goal-api.ts`, so a check elsewhere shows up on return.
3. Copy in the four i18n files; `pnpm test:lexicon`; `cd frontend && pnpm exec ng build`.
4. `docs/BUSINESS_RULES.md`: suggestion rules, that a dismissed movement is forgotten, and that a movement unchecked then checked again after an apply counts again (accepted ceiling).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | Column present in `database.types.ts`; the migration contract check passes as expand |
| 2    | `GET /v1/assets` returns the suggestion values of the Test Scope; specs pass |
| 3    | Apply leaves `suggestion: null` with a new snapshot; dismiss hides it, and the next suggestion counts only later checks |
| 4    | The row shows, applies and dismisses the suggestion; checking a prévision then returning to the page shows it without reload; `ng build` passes |
