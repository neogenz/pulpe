# Task: Code Review Issues - Widget iOS Branch

## Summary

Complete code review of the `widget_ios` branch compared to `main`. Two reviews were conducted:
1. **General iOS Review**: Architecture, patterns, SwiftUI standards
2. **Widget-Specific Review**: Widget implementation, sync, background refresh

**Total Issues Found: 14**
- P1 Critical: 5
- P2 Important: 6
- P3 Minor: 5

---

## P1 - Critical Issues

### 1. AnyView Anti-Pattern in AlertsSection

**File**: `ios/Pulpe/Features/CurrentMonth/Components/AlertsSection.swift:9`

```swift
// CURRENT - Type erasure breaks SwiftUI diffing
if alerts.isEmpty { return AnyView(EmptyView()) }
return AnyView(Section { ... })
```

**Fix**: Use `@ViewBuilder` instead
```swift
@ViewBuilder
var body: some View {
    if !alerts.isEmpty {
        Section { ... }
    }
}
```

**Impact**: Performance degradation, unnecessary view updates

---

### 2. AnyView Anti-Pattern in UncheckedTransactionsSection

**File**: `ios/Pulpe/Features/CurrentMonth/Components/UncheckedTransactionsSection.swift:9`

Same issue as #1.

**Fix**: Same solution - use `@ViewBuilder`

---

### 3. CurrentMonthViewModel Missing @MainActor on Class

**File**: `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:127`

```swift
// CURRENT - Only methods are MainActor, not the class
@Observable
final class CurrentMonthViewModel {
    private(set) var budget: Budget?
    // ...
}
```

**Fix**: Add `@MainActor` to class declaration
```swift
@Observable @MainActor
final class CurrentMonthViewModel { ... }
```

**Impact**: Potential thread-safety issues with published properties

---

### 4. BudgetDetailsViewModel Missing @MainActor on Class

**File**: `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetDetailsView.swift:215`

Same issue as #3.

**Fix**: Same solution

---

### 5. Missing UIBackgroundModes for Background Fetch

**File**: `ios/project.yml` (and `ios/Pulpe/Resources/Info.plist`)

`BGTaskSchedulerPermittedIdentifiers` is defined but `UIBackgroundModes` is NOT configured.

**Current**:
```yaml
BGTaskSchedulerPermittedIdentifiers:
  - app.pulpe.ios.widget-refresh
# UIBackgroundModes is MISSING
```

**Fix**: Add `UIBackgroundModes` in `project.yml` around line 80:
```yaml
info:
  properties:
    UIBackgroundModes:
      - fetch
    BGTaskSchedulerPermittedIdentifiers:
      - app.pulpe.ios.widget-refresh
```

**Impact**: Widget background refresh will NEVER execute without this. Critical for widget data freshness.

---

## P2 - Important Issues

### 6. AppState Missing @MainActor on Class

**File**: `ios/Pulpe/App/AppState.swift:5`

```swift
// CURRENT
@Observable
final class AppState { ... }

// FIX
@Observable @MainActor
final class AppState { ... }
```

**Impact**: UI state management should be MainActor-isolated for thread safety

---

### 7. DateFormatter Created Inline in Budget Model

**File**: `ios/Pulpe/Domain/Models/Budget.swift:21-48`

```swift
var monthYear: String {
    let formatter = DateFormatter()  // Expensive! Created each access
    formatter.locale = Locale(identifier: "fr_FR")
    // ...
}
```

**Fix**: Use existing `Formatters.monthYear` static formatter

---

### 8. Deprecated NavigationLink API in View Extension

**File**: `ios/Pulpe/Shared/Extensions/View+Extensions.swift:77-91`

```swift
// DEPRECATED iOS 16+
NavigationLink(
    destination: destination(),
    isActive: isActive,
    label: { EmptyView() }
)
```

**Fix**: Remove this extension entirely. Use `NavigationStack(path:)` pattern already used elsewhere.

---

### 9. Duplicated DateFormatter in YearOverviewEntry

**File**: `ios/PulpeWidget/Widgets/YearOverview/YearOverviewEntry.swift:66-76`

Same inline DateFormatter issue as #7.

**Fix**: Use `Formatters.shortMonth` already defined

---

### 10. No relevance() for Smart Stacks

**Files**: `CurrentMonthProvider.swift`, `YearOverviewProvider.swift`

TimelineProviders don't implement `relevance()` for iOS 17+ Smart Stack prioritization.

**Fix**: Add relevance method:
```swift
func relevance(in context: Context) async -> TimelineEntryRelevance? {
    guard let cache = coordinator.load(),
          let current = cache.currentMonth,
          let available = current.available else { return nil }
    // Higher priority if budget is negative
    return available < 0 ? TimelineEntryRelevance(score: 1.0) : nil
}
```

---

### 11. No Error Logging When App Group Fails

**File**: `ios/PulpeWidget/Services/WidgetDataCoordinator.swift:7-9`

```swift
private var sharedDefaults: UserDefaults? {
    UserDefaults(suiteName: Self.appGroupId)  // Can return nil silently
}
```

**Fix**: Add debug logging when nil

---

## P3 - Minor Issues

### 12. Magic Strings for UserDefaults Keys

**File**: `ios/Pulpe/App/AppState.swift:25-31`

```swift
// CURRENT - Magic strings
UserDefaults.standard.bool(forKey: "pulpe-onboarding-completed")
```

**Fix**: Centralize in enum
```swift
enum UserDefaultsKey {
    static let onboardingCompleted = "pulpe-onboarding-completed"
    static let tutorialCompleted = "pulpe-tutorial-completed"
    static let biometricEnabled = "pulpe-biometric-enabled"
}
```

---

### 13. Preview Missing AppState Environment

**File**: `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:415`

```swift
#Preview {
    NavigationStack {
        CurrentMonthView()  // Missing .environment(AppState())
    }
}
```

---

### 14. Invalid iOS 26 Availability Check

**File**: `ios/Pulpe/Features/CurrentMonth/Components/HeroBalanceCard.swift:169`

```swift
if #available(iOS 26, *) {  // iOS 26 doesn't exist yet
    content.glassEffect(...)
}
```

**Fix**: Use iOS 18 for current APIs or add comment for future

---

## Key Files to Modify

| Priority | File | Line | Issue Summary |
|----------|------|------|---------------|
| P1 | `AlertsSection.swift` | 9 | AnyView → @ViewBuilder |
| P1 | `UncheckedTransactionsSection.swift` | 9 | AnyView → @ViewBuilder |
| P1 | `CurrentMonthView.swift` | 127 | Add @MainActor to class |
| P1 | `BudgetDetailsView.swift` | 215 | Add @MainActor to class |
| P1 | `project.yml` | ~80 | Add UIBackgroundModes: [fetch] |
| P2 | `AppState.swift` | 5 | Add @MainActor to class |
| P2 | `Budget.swift` | 21-48 | Use Formatters.monthYear |
| P2 | `View+Extensions.swift` | 77-91 | Remove deprecated extension |
| P2 | `YearOverviewEntry.swift` | 66-76 | Use Formatters.shortMonth |
| P2 | `CurrentMonthProvider.swift` | - | Add relevance() |
| P2 | `YearOverviewProvider.swift` | - | Add relevance() |
| P2 | `WidgetDataCoordinator.swift` | 7-9 | Add error logging |
| P3 | `AppState.swift` | 25-31 | Centralize UserDefaults keys |
| P3 | `CurrentMonthView.swift` | 415 | Fix preview environment |
| P3 | `HeroBalanceCard.swift` | 169 | Fix iOS version check |

---

## Patterns to Follow

### Existing Good Patterns Found

1. **@Observable + @MainActor**: `OnboardingState` uses `@Observable` correctly
2. **Actors for Services**: `APIClient`, `AuthService`, `KeychainManager` are all actors
3. **Static Formatters**: `Formatters` enum provides cached formatters
4. **Sendable Models**: All domain models conform to `Sendable`
5. **App Group Sync**: Widget sync via shared UserDefaults works correctly

### SwiftUI Best Practices Reference

Per Apple documentation:
- Use `@Observable @MainActor` for view models
- Prefer `@ViewBuilder` over `AnyView` for conditional views
- Use `.task` modifier for async work (already done correctly)
- Use `@State` with `@Observable` objects (already done correctly)

---

## Dependencies

- **Xcode 15+** (SWIFT_VERSION: 5.9)
- **iOS 17.0** deployment target
- **App Group**: `group.app.pulpe.ios`
- **Background Task ID**: `app.pulpe.ios.widget-refresh`

---

## Next Steps

1. Run `/epct:plan 03-code-review-issues-widget-ios` to create implementation plan
2. Priority order: P1 issues first (especially UIBackgroundModes)
3. Run `pnpm quality` equivalent (`xcodebuild build`) after changes
