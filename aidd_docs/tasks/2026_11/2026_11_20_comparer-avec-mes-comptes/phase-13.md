---
status: pending
---

# Instruction: Android: guide

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── android/src/
    ├── core/i18n/catalogs/
    │   ├── fr.json ✏️
    │   ├── en.json ✏️
    │   ├── de.json ✏️
    │   └── it.json ✏️
    └── features/current-month/
        ├── reconcile-guide.ts ✅
        ├── reconcile-guide.spec.ts ✅
        ├── reconcile-guide-gate.ts ✅
        ├── reconcile-guide-gate.spec.ts ✅
        └── components/
            ├── reconcile-guide-page.tsx ✅
            ├── reconcile-guide-page.spec.tsx ✅
            ├── reconcile-accounts-sheet.tsx ✏️
            └── reconcile-accounts-sheet.spec.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Fresh install on the Pixel test device, demo user | Home page | system |
| Happy path | Open the comparison for the first time | Scene 1, « Suivant » twice, « Comparer maintenant » shows step 1 (viewed and completed events with `source: auto` are checked in the guide spec: PostHog is off locally) | system |
| Happy path | Close, open again | Step 1 directly | system |
| Happy path | Type 890, « ? », « Passer » | Step 1 with 890 kept (skipped event with `source: help` checked in the guide spec) | system |
| Edge case | Remove animations on (system setting) | Final state of each scene at once | system |
| Edge case | TalkBack | Scene drawing hidden, title and sentence read | system |
| Edge case | Back gesture or scrim during the guide | Counted as skipped once; flag set | system |

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

1. « Passer » on every scene.
2. Decorative scene from spec.md §2, hidden from TalkBack.
3. Action title.
4. One sentence, the scene's accessibility label.
5. `StepDots`, « Étape N sur 3 ».
6. Primary button: « Suivant », then « Comparer maintenant ».

## Tasks to do

### `1)` Guide content and gate

> Scenes and the per-device flag, like `net-worth-intro.ts` and `net-worth-intro-gate.ts`.

1. `reconcile-guide.ts`: 3 scenes of spec.md §2 and sample figures.
2. `reconcile-guide-gate.ts`: MMKV store, key `pulpe-reconcile-guide-seen`.

### `2)` Guide page

> The 3 scenes animated with Reanimated like `net-worth-intro-sheet.tsx`.

1. `reconcile-guide-page.tsx`: scene keyed by name so each replays, `BEAT_MS` stagger, count-up 950.00 → 890.00, `useReducedMotion()` shows the end state.
2. Emits the three guide events with `source`, one end event per open.

### `3)` Page inside the comparison sheet

> First open starts on the guide; « ? » replays it and keeps the typed values.

1. `reconcile-accounts-sheet.tsx` starts on the guide when unseen, sets the flag on any exit, adds a « ? » header action (`help-circle-outline`, label « Revoir le guide »).
2. Strings in the 4 catalogs.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Gate spec: unseen → present, seen → skip; content spec lists 3 scenes |
| 2 | Guide page spec: titles and sentences rendered, drawing hidden from accessibility, one end event |
| 3 | Sheet spec: first open on the guide, « ? » keeps typed rows; `cd android && pnpm quality` and `pnpm test` pass |
