---
objective: "The Android screens fixed after the 2026-11-18 UX audit match iOS on budget captions, PIN feedback, the prevision picker's back, budget line rows and touch targets, with Jest locking each behavior."
status: implemented
---

# Plan: Android UX audit fixes

Source: Codex UX audit of the Android app (19 emulator screenshots, 2026-11-18), each finding re-checked in the code against iOS. Rule: Android matches iOS feature for feature; a finding where iOS behaves the same is not a defect.

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Copy and contrast: budget captions, PIN dots and subtitle | [`phase-1.md`](./phase-1.md) | none |
| 2   | Movement sheet: visible back from the prevision picker | [`phase-2.md`](./phase-2.md) | none |
| 3   | Budget line row (separate point target, large text) and 48dp targets | [`phase-3.md`](./phase-3.md) | none |
| 4   | Remove the quick amount chips from the entry sheets | [`phase-4.md`](./phase-4.md) | 2 |

## External sources

| URL | What it settled |
| --- | --------------- |
| https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast | PIN dots need 3:1 against their background |
| https://m3.material.io/foundations/designing/structure | 48dp minimum touch target |
| https://github.com/expo/expo/issues/39092 | Predictive back stays disabled: blocked upstream on SDK 57 |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| Runtime | On a fresh worktree, from the repo root, with Node 24 and pnpm 10.12.1: `pnpm install --frozen-lockfile && pnpm --filter pulpe-shared build:esm` (`pulpe-shared` resolves from `shared/dist/esm`, absent until built). Applies to every phase, whatever the order. Then `pnpm --dir android run quality`, the phase's Jest suites, and `pnpm test:lexicon` from the root | phases 1-3 |
| Regression | Medium. `SectionHeader` (22 uses in 17 files), `FormModal` (27 uses), `SegmentedPicker` (10 uses) are shared atoms. Covered by `sheet.spec.tsx`, `transaction-sheet.spec.tsx` (mocks `FormModal`), `pin-pad.spec.tsx`, `budgets-screen.spec.tsx`. No spec yet for `budget-line-row`, `segmented-picker`, `section-header`. New specs count in the ~300 net LOC | phases 1-3 |
| Architecture | none: no new module, no data flow change | none |
| Documentation | none: `android/DESIGN.md:99` already states 48dp targets; the change brings the code to it | none |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Android matches iOS screen for screen, keeping documented Android adaptations | Every fix takes its target from the iOS file named in the task |
| Product copy French in « tu » voice; « transaction » never on screen (`pnpm test:lexicon`) | Phase 1 changes copy in 4 catalogs |
| Translations come from `ios/Pulpe/Resources/Localizable.xcstrings`, never invented | Phase 1 and 2 strings |
| The executor leaves changes uncommitted. The orchestrator reviews them and commits only if Maxime explicitly requests it (Conventional Commits in English, no attribution lines) | Execution |
| Past ~300 net LOC, stop and report | Scope discipline (`CLAUDE.md`) |

## Decisions

| Decision | Why |
| -------- | --- |
| Excluded: confirmation before discarding a sheet draft | iOS has none (`MovementSheet` only blocks dismiss while submitting): parity |
| Excluded: « À pointer » wording on Accueil vs Mouvements | Identical to iOS `MovementsPage.swift` |
| Excluded: predictive back | `predictiveBackGestureEnabled: false` is deliberate, blocked upstream by `react-native-screens` 4.26.2 (expo/expo#39092) |
| Excluded: FAB bottom padding | `FAB_CLEARANCE = 96` clears the end of the scroll. Still to check on a device: « Afficher » reachable and tappable with closed months folded |
| Excluded: goal projection chart on the goal detail | iOS no longer shows « Ta trajectoire » on the goal detail; its chart lives in the plan simulator (`GoalPlanSimulatorSheet.swift:77`), which Android lacks. Placement parity is a separate task; the empty render seen on Android stays to diagnose on a device |
| Remove the quick amount chips from the Android entry sheets | Maxime, 2026-11-18: Android has the same features and forms as iOS, only the look is Android-specific. iOS shows the chips only when creating a template (`CreateTemplateView.swift`); adding them to Android's template creation is a separate task |
| Excluded: hero amount labels (current « Disponible à dépenser », audit's « Après tes prévisions ») and the disabled prevision question in edit mode | Same copy and behavior as iOS; product decision |
