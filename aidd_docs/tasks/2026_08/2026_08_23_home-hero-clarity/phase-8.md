---
status: done
---

# Instruction: Bas d'écran : rien ne se cache sous la barre

## Architecture projection

```txt
ios/Pulpe
├── Features/CurrentMonth/CurrentMonthView.swift               ✏️ bottom content inset = tab bar height + lg
├── Shared/Components/HeroZone/HeroVerdictRow.swift            ✏️ link hit area ≥ 44 pt
└── Shared/Components/SectionHeader.swift                      ✏️ « Tout voir » hit area ≥ 44 pt
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Happy path
    scrolled to bottom => last card fully above the tab bar, nothing legible behind the blur: 5: system
    « Voir le budget » / « Tout voir » => 44 pt tall tap target, visual size unchanged: 5: system
```

## Tasks to do

### `1)` Bottom inset

1. `CurrentMonthView` scroll content: `.safeAreaPadding(.bottom, …)` or `.contentMargins(.bottom, DesignTokens.TabBar.clearance, for: .scrollContent)`; verify against `BudgetDetailsView` which may already solve it (reuse the same modifier).

### `2)` 44 pt links

1. `HeroVerdictRow` link and `SectionHeader` link: `.frame(minHeight: DesignTokens.TapTarget.minimum)` + `.contentShape(Rectangle())`, no visual change.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Screenshot at scroll end: no content under the bar |
| 2 | Accessibility Inspector (or `accessibilityFrame` test) reports ≥ 44 pt on both links |

## Outcome (2026-08-23)

No code. Both links already clear 44 pt: `HeroVerdictRow` frames its button at `TapTarget.minimum`, `SectionHeader.linkButton` pads its content shape by half the target on each edge. Content scrolling under the translucent tab bar is the iOS 26 system behaviour; the scroll view's safe area keeps the last card above the bar at scroll end, so an extra inset would double it.
