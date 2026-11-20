# Codebase Audit: ui (PR #915, cbe305587..213322c41)

Roles, states, 48dp targets and font-scale wrapping are in place; three small visual doubts left for a device.

- **Date**: 2026_11_20
- **Scope**: diff of branch claude/android-home-hero-ios-parity-e3c75b against main, read with callers and neighbours
- **Health**: good
- **Findings**: 0 critical, 0 major, 3 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | -------- | -------- | ----- | ------------- | ------ |
| 🟢 | ui | `android/src/core/ui/sheet.tsx:173` | The back arrow sits after the 24dp header padding: on the « Autre » step the title shifts right by 56dp versus the form step, the glyph lands ~36dp from the edge (MD3: 16dp). Unverified on device. | Reduce `paddingLeft` when the back button shows. | S |
| 🟢 | ui | `android/src/features/current-month/components/balance-trajectory-chart.tsx:107` | Only `.onUpdate` feeds the scrub: a finger held still after the 150ms hold shows no reading until it moves; iOS shows it at once. Pre-existing, unverified on device. | Add `.onStart` calling `onScrub(scrubDayAt(...))`. | S |
| 🟢 | ui | `android/DESIGN.md:94` | Says `SectionHeader` has a « Manrope title »; code uses MD3 `titleLarge` on the system face (`section-header.tsx:26`). Pre-existing doc drift. | Align the DESIGN.md line. | S |

## Top actions

1. On the emulator: check the « Autre » header alignment and the selected-segment border, then decide on the padding fix.
2. Add `.onStart` to the scrub gesture.
3. Fix the DESIGN.md line.

## Coverage

- **Scanned**: ui (TalkBack roles and states, 48dp targets, PIN dot contrast tokens light/dark, font scale 1 / 1.5 / 2 in specs, design tokens, DESIGN.md consistency, emulator captures from the Codex UX pass)
- **Skipped**: automated a11y scan (no axe equivalent run on React Native)
