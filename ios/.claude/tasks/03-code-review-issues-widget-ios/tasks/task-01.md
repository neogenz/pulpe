# Task: Replace AnyView Anti-Pattern with @ViewBuilder

## Problem

Two SwiftUI section components use `AnyView` type erasure for conditional rendering, which breaks SwiftUI's structural identity and diffing algorithm. Per WWDC 2021 "Demystify SwiftUI", Apple explicitly calls AnyView "the evil nemesis of structural identity", causing 10-17% performance degradation.

**Affected files:**
- `AlertsSection.swift` - Uses `return AnyView(EmptyView())` and `return AnyView(Section {...})`
- `UncheckedTransactionsSection.swift` - Same pattern

## Proposed Solution

Replace the `AnyView` wrapper pattern with SwiftUI's implicit `@ViewBuilder` on the body property, using simple conditional rendering with `if` statements. This preserves structural identity and allows SwiftUI to efficiently diff view hierarchies.

## Dependencies

- None (can start immediately)

## Context

- Key files:
  - `ios/Pulpe/Features/CurrentMonth/Components/AlertsSection.swift:8-46`
  - `ios/Pulpe/Features/CurrentMonth/Components/UncheckedTransactionsSection.swift:8-39`
- The View protocol's body property implicitly uses @ViewBuilder
- Pattern to follow: Any other conditional view in the codebase using `if condition { View() }` syntax

## Success Criteria

- Both files no longer import or use `AnyView`
- Both files use conditional `if !isEmpty { Section {...} }` pattern
- Build succeeds with `xcodebuild -scheme Pulpe -sdk iphonesimulator build`
- Previews render correctly in Xcode for both empty and populated states
