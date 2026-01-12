# Task: Remove Deprecated Code and Fix iOS Version Checks

## Problem

Several minor code quality issues remain:

1. **Deprecated NavigationLink API** (`View+Extensions.swift:77-91`): Uses iOS 13-15 `NavigationLink(destination:isActive:label:)` API deprecated in iOS 16+. The app already uses `NavigationStack(path:)` pattern elsewhere.

2. **Invalid iOS 26 availability checks** (2 locations): iOS 26 doesn't exist yet. These should either use iOS 18 for current APIs or be documented as future-proofing.
   - `View+Extensions.swift:137` - `applyScrollEdgeEffect()`
   - `HeroBalanceCard.swift:169` - `HeroCardStyleModifier`

## Proposed Solution

1. Search codebase for usages of the `navigate()` extension, then remove it if unused
2. Fix iOS availability checks to use correct version (iOS 18) or add documentation explaining future API intent

## Dependencies

- None (can start immediately)
- Should be done after Tasks 1-5 (lower priority P2/P3)

## Context

- Key files:
  - `ios/Pulpe/Shared/Extensions/View+Extensions.swift:77-91` - Deprecated navigate()
  - `ios/Pulpe/Shared/Extensions/View+Extensions.swift:137-142` - iOS 26 check
  - `ios/Pulpe/Features/CurrentMonth/Components/HeroBalanceCard.swift:169` - iOS 26 check
- App deployment target: iOS 17.0
- `glassEffect` and `scrollEdgeEffectStyle` APIs need version verification
- Pattern: Use `#available(iOS 18, *)` for iOS 18+ APIs

## Success Criteria

- `navigate()` extension removed (if unused) or documented (if still needed)
- No references to iOS 26 in codebase
- All availability checks use valid iOS versions
- Build succeeds
- No deprecation warnings in Xcode
