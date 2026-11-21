---
status: pending
---

# Instruction: iOS: guide

## Architecture projection

> Tree of the final files from the project root, each folder ending in `/`. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/
    ├── Pulpe/
    │   ├── Resources/
    │   │   └── Localizable.xcstrings ✏️
    │   └── Features/CurrentMonth/Reconciliation/
    │       ├── ReconcileGuideContent.swift ✅
    │       ├── ReconcileGuideGate.swift ✅
    │       ├── ReconcileGuideView.swift ✅
    │       └── ReconcileAccountsSheet.swift ✏️
    └── PulpeTests/Features/CurrentMonth/
        └── ReconcileGuideTests.swift ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `xcodegen generate --use-cache`, dedicated test simulator, fresh install | App on the home page | system |
| Happy path | Open « Comparer avec mes comptes » for the first time | Scene 1, « Suivant » twice, « Comparer maintenant » shows the form (viewed and completed events with `source: auto` are checked in `ReconcileGuideTests`: PostHog is off locally) | system |
| Happy path | Close, open again | The form directly | system |
| Happy path | Type 890, tap « ? », « Passer » | Back on the form with 890 kept (skipped event with `source: help` checked in the unit tests) | system |
| Edge case | Réduire les animations on | Final state of each scene at once | system |
| Edge case | VoiceOver | Scene drawing hidden, title and sentence read | system |
| Edge case | Swipe the sheet down during the guide | Counted as skipped once; flag set | system |

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

1. « Passer » toolbar button on every scene.
2. Decorative scene from spec.md §2, hidden from VoiceOver.
3. Action title.
4. One sentence, the scene's accessibility label.
5. Page dots, « Étape N sur 3 ».
6. Primary button: « Suivant », then « Comparer maintenant ».

## Tasks to do

### `1)` Guide content and gate

> Scenes and the per-device flag, like `NetWorthIntroContent.swift` and `NetWorthIntroGate.swift`.

1. `ReconcileGuideContent.swift`: 3 scenes of spec.md §2, sample figures, one-end-event guard like `NetWorthIntroCompletion`.
2. `ReconcileGuideGate.swift`: `@AppStorage("hasSeenReconcileGuide")`, should-present rule.

### `2)` Guide view

> The 3 scenes animated with the same timeline approach as `NetWorthIntroScene.swift`.

1. `ReconcileGuideView.swift`: one view per scene so each replays, staggered springs, `.contentTransition(.numericText)` for 950.00 → 890.00, Reduce Motion shows the end state.
2. Emits the three guide events with `source`.

### `3)` Page inside the comparison sheet

> First open starts on the guide; « ? » replays it and keeps the typed values.

1. `ReconcileAccountsSheet.swift` shows the guide page first when the gate says so, sets the flag on any exit, and adds a « ? » toolbar button (`questionmark.circle`, label « Revoir le guide »).
2. Strings in `Localizable.xcstrings` with en, de, it.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `ReconcileGuideTests`: gate presents only when unseen; one end event per open |
| 2 | Scenes render under Reduce Motion with final values (snapshot of state, not pixels) |
| 3 | The happy path above holds on the test simulator; `PulpeTests` and SwiftLint strict pass |
