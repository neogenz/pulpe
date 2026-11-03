---
status: pending
---

# Instruction: Income drawn from an asset

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete. Files created by an earlier phase of this plan are marked `modify (phase n)`.

```txt
.
├── docs/
│   └── BUSINESS_RULES.md ✏️
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
                    ├── pattern/
                    │   └── asset-picker/
                    │       ├── asset-picker-field.ts        modify (phase 5)
                    │       └── asset-picker-field.spec.ts   modify (phase 5)
                    └── feature/
                        └── budget/
                            └── budget-details/
                                └── budget-line/
                                    ├── create/
                                    │   └── dialog.ts ✏️
                                    └── edit/
                                        └── dialog.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Revenue-origin switch web phase 3 merged; flag forced through the `pulpe-dev-feature-flags` override; « Livret » at 3 000 CHF | Budget page open | browser |
| Happy path | Create a Revenu 1 000, origin « D'un avoir », pick « Livret » | Saved with `assetId` | browser |
| Happy path | Open that Revenu in the edit dialog | « Livret » shows as a read-only origin, like a savings-goal source | browser |
| Happy path | Check that Revenu, open « Mon patrimoine » | « Livret » proposes 2 000 CHF | browser |
| Edge case  | Choose « D'un avoir » then the savings-goal origin before saving | Only one origin is kept; the payload never carries both | browser |
| Edge case  | No active own asset | « D'un avoir » is not offered | browser |
| Edge case  | Flag off | The switch shows only its existing choices | browser |
| Teardown   | Delete the test prévision, remove the flag override | Baseline restored | browser |

## Tasks to do

### `1)` Check the precondition

> This phase builds on the web revenue-origin switch.

1. Confirm `aidd_docs/tasks/2026_10/2026_10_20_revenue-origin-switch/phase-3.md` is done and merged; stop and report otherwise.
2. Read the shipped switch in `create/dialog.ts` before editing.

### `2)` « D'un avoir » origin on create

> A Revenu can be drawn from an own asset, where the origin is chosen today.

1. Add « D'un avoir » to the switch, under the flag, with the asset picker on own assets.
2. Mutually exclusive with the savings-goal origin; clear `assetId` when another origin is chosen.
3. Picker spec for the income case if the picker needs a change.

### `3)` Read-only origin on edit

> The edit dialog shows the asset origin the way it shows a savings-goal source.

1. In `edit/dialog.ts`, a Revenu with `assetId` shows the asset name read-only beside the existing `pulpe-savings-goal-source-line` block (`edit/dialog.ts:164-175`); no picker.
2. The template line dialog has no income origin today and gets none.

### `4)` Copy and rules

> Wording and business rule written down.

1. Copy in « je » in the four i18n files; `pnpm test:lexicon`.
2. `docs/BUSINESS_RULES.md`: a Revenu drawn from an asset lowers its proposed value once checked; its origin is set at creation only.
3. `cd frontend && pnpm exec ng build`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | The revenue-origin switch is on `main` before any edit |
| 2    | A Revenu saved with « D'un avoir » carries `assetId`, and checking it yields the phase 6 suggestion |
| 3    | The edit dialog shows the asset origin and offers no way to change it |
| 4    | `ng build` and `pnpm test:lexicon` pass |
