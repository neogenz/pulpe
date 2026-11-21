---
status: pending
---

# Instruction: Web: guide

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
            ├── core/storage/
            │   ├── storage-keys.ts ✏️
            │   └── storage-schemas.ts ✏️
            └── pattern/reconcile-accounts/
                ├── reconcile-guide.model.ts ✅
                ├── reconcile-guide.ts ✅
                ├── reconcile-guide.spec.ts ✅
                ├── reconcile-accounts-dialog.ts ✏️
                ├── reconcile-accounts-dialog.html ✏️
                ├── reconcile-accounts-dialog.spec.ts ✏️
                ├── reconcile-accounts-dialog.service.ts ✏️
                └── reconcile-accounts-dialog.service.spec.ts ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Demo user, storage cleared, viewports 1280×800 and 390×664 | Home shows the comparison button | browser |
| Happy path | Open the comparison for the first time | Scene 1 shows first, « Suivant » twice, then « Comparer maintenant » lands on step 1; `account_reconciliation_guide_viewed` then `_completed` with `source: auto` | browser |
| Happy path | Close, open again | Step 1 directly, no guide | browser |
| Happy path | Type 890 on step 1, tap « ? », tap « Passer » | Back on step 1 with 890 still typed; `_skipped` with `source: help` | browser |
| Edge case | `prefers-reduced-motion: reduce` | Each scene shows its final state at once | browser |
| Edge case | Screen reader tree | The scene drawing is hidden; the title and sentence are read | browser |
| Edge case | Phone width | Full-screen dialog, buttons in reach without scrolling | browser |
| Teardown | Clear the seen key | Next open shows the guide again | browser |

## Wireframe

```txt
┌──────────────────────────────────┐
│ (1)                       Passer │
│ ┌──────────────────────────────┐ │
│ │ (2) animated scene           │ │
│ │     bank screen · Pulpe      │ │
│ └──────────────────────────────┘ │
│ (3) Title                        │
│ (4) Sentence with the example    │
│ (5)            ● ○ ○             │
│ (6) [          Suivant         ] │
└──────────────────────────────────┘
```

1. Skip action on every scene, leads to step 1.
2. Decorative scene from spec.md §2, `aria-hidden`.
3. Action title.
4. One sentence, the only text read for the scene.
5. Step dots, accessible name « Étape N sur 3 ».
6. Primary action: « Suivant », then « Comparer maintenant » on scene 3.

## Tasks to do

### `1)` Guide content and seen flag

> Scenes, sample figures and a per-device flag declared once.

1. `reconcile-guide.model.ts`: the 3 scenes of spec.md §2 with their sample figures (890.00, 950.00, essence 60).
2. Storage key `pulpe-reconcile-guide-seen` (boolean, `scope: 'app'`) in `storage-keys.ts` and `storage-schemas.ts`.

### `2)` Guide page

> The 3 scenes animated in CSS like `net-worth-intro-dialog.ts`, readable without motion.

1. `reconcile-guide.ts`: one scene per `@switch` branch so each replays, keyframes with `--i` delays, one `prefers-reduced-motion` block, `sr-only` sentence.
2. Outputs: finished (`completed` or `skipped`); emits the three guide events with `source`.

### `3)` Wire it into the comparison dialog

> First open starts on the guide; « ? » replays it without losing typed values.

1. The dialog gets a `guide` view before its steps; the service starts on it when the key is unset and writes the key on any guide exit.
2. Header « ? » button (`aria-label` « Revoir le guide ») on every step; leaving the guide returns to the step it came from.
3. Dialog title « Comparer avec mes comptes »; guide strings in the 4 catalogs.

### `4)` Desktop and phone check

> The guide works at both widths.

1. Extend `account-reconciliation.spec.ts`: first open shows the guide, second does not, « ? » keeps the typed amount, at 1280×800 and 390×664.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `storage.service` schema check accepts the key; the model lists 3 scenes |
| 2 | `reconcile-guide.spec.ts`: each scene renders its title and sentence, the drawing is `aria-hidden`, one end event per open |
| 3 | Dialog spec: unseen key starts on the guide, seen key starts on step 1, « ? » returns to the same step with values kept |
| 4 | The e2e test passes at both viewports; `cd frontend && pnpm exec ng build` passes |
