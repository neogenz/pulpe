---
description: "SwiftUI view patterns, state management, and iOS 26 features"
paths: "ios/**/*.swift"
---

# SwiftUI

## State Management

### @Observable (Modern Pattern - iOS 17+)

```swift
@Observable @MainActor
final class MyStore {
    private(set) var items: [Item] = []
    private(set) var isLoading = false
}
```

- Use `@Observable` for all stores and view models
- Always combine `@MainActor` for UI state
- `private(set)` for all published properties
- **NEVER** use `ObservableObject` + `@Published` (legacy pattern)

### Property Wrappers

| Wrapper | Use | Example |
|---------|-----|---------|
| `@State` | View-local value state | `@State private var isEditing = false` |
| `@State` | View-owned observable | `@State private var viewModel = VM()` |
| `@Binding` | Two-way parent connection | `@Binding var amount: Decimal` |
| `@Environment` | Injected stores/system values | `@Environment(AppState.self) private var appState` |
| `@Bindable` | Make @Observable bindable | `@Bindable var store = store` |

### FORBIDDEN Wrappers

- `@StateObject` → Use `@State` with `@Observable`
- `@ObservedObject` → Use `@Environment` or `@Bindable`
- `@EnvironmentObject` → Use `@Environment(Type.self)`
- `@Published` → Use `@Observable` properties directly

### Environment Injection

```swift
// Provide (App level)
MainTabView()
    .environment(appState)
    .environment(currentMonthStore)

// Consume (View level)
struct BudgetListView: View {
    @Environment(BudgetListStore.self) private var store
    @Environment(AppState.self) private var appState
}
```

## View Composition

### Keep Views Small

```swift
// Good - extracted subview
struct BudgetCard: View {
    let budget: Budget

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(budget.name).font(.headline)
            Text(budget.formattedTotal).font(.subheadline)
        }
    }
}

// Bad - everything in one view body
```

### ViewBuilder for Conditional Content

```swift
@ViewBuilder
private var contentView: some View {
    if store.isLoading {
        ProgressView()
    } else if let error = store.error {
        ContentUnavailableView("Erreur", systemImage: "exclamationmark.triangle")
    } else {
        budgetList
    }
}
```

### Loading Pattern

```swift
var body: some View {
    Group {
        if store.isLoading && store.budget == nil {
            ProgressView()
        } else if let budget = store.budget {
            BudgetContent(budget: budget)
        } else {
            ContentUnavailableView("Aucun budget", systemImage: "tray")
        }
    }
    .task { await store.loadIfNeeded() }
    .refreshable { await store.forceRefresh() }
}
```

## Navigation

### NavigationStack with Typed Destinations

```swift
enum BudgetDestination: Hashable {
    case details(id: String)
    case edit(budget: Budget)
}

struct BudgetListView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            List { /* ... */ }
                .navigationDestination(for: BudgetDestination.self) { dest in
                    switch dest {
                    case .details(let id): BudgetDetailsView(budgetId: id)
                    case .edit(let budget): BudgetEditView(budget: budget)
                    }
                }
        }
    }
}
```

### Sheet-Based Forms

```swift
// Good - sheet with completion callback + standard presentation
.sheet(isPresented: $showAddExpense) {
    AddExpenseView { newExpense in
        await store.addExpense(newExpense)
    }
    .standardSheetPresentation()  // detents + drag indicator + cornerRadius + background
}
```

### Sheet Presentation (iOS 26 Liquid Glass)

All sheets **must** have explicit presentation background. Prevents iOS 26 Liquid Glass transparency bleed:

```swift
// Good — use the shared modifier (includes detents, drag indicator, corner radius, background)
.standardSheetPresentation()
.standardSheetPresentation(detents: [.medium, .large])

// Good — custom background (e.g. gradient sheets like RecoveryKeySheet)
.presentationBackground { Color.loginGradientBackground }
.presentationBackground(Color.sheetBackground)

// Bad — iOS 26 glass bleeds through without explicit presentation background
.sheet(isPresented: $show) {
    MyView()  // No presentationBackground → broken on iOS 26
}
```

### Navigation Rules

- `NavigationStack(path:)` for push navigation
- `.sheet()` for modal forms and detail views
- `.fullScreenCover()` for immersive flows (onboarding, auth)
- **NEVER** use `NavigationView` (deprecated)
- **NEVER** use `NavigationLink` without typed destination

## Lists and Performance

```swift
// Good - LazyVStack for custom layouts
ScrollView {
    LazyVStack(spacing: 12) {
        ForEach(transactions) { tx in
            TransactionRow(transaction: tx)
        }
    }
}

// Good - List for standard appearance
List(budgets) { budget in
    BudgetRow(budget: budget)
}
```

- Use `List` for standard scrolling lists
- Use `LazyVStack` in `ScrollView` for custom layouts
- Always provide stable `id` (via `Identifiable`)
- Extract row views for better performance

## Async Operations

```swift
// Good - .task for loading
.task { await store.loadIfNeeded() }

// Good - .task(id:) for reactive loading
.task(id: budgetId) {
    await store.loadBudget(id: budgetId)
}

// Good - .refreshable for pull-to-refresh
.refreshable { await store.forceRefresh() }
```

**NEVER** use `.onAppear { Task { } }` — use `.task { }` instead.

## iOS 26 Features

### Liquid Glass (Navigation Layer Only)

```swift
// System handles glass automatically for:
// - Toolbars, tab bars, navigation bars
// - Sheet presentations with partial detents

// Custom glass effect
Button("Action") { }
    .glassEffect()

// Glass with tinting
.glassEffect(.regular.tint(.purple.opacity(0.8)))
```

**Rules:**
- Apply glass ONLY to navigation elements (toolbars, tabs, floating buttons)
- NEVER apply glass to content (lists, cards, text)
- Remove explicit backgrounds that block glass transparency
- System handles glass for standard navigation components automatically

### Sheet Presentation

```swift
.sheet(isPresented: $showInfo) {
    InfoView()
        .presentationDetents([.medium, .large])
        // Liquid Glass background automatic with partial detents
}
```

## iOS 26 Gotchas

### NavigationLink Gesture Conflicts

iOS 26 refactored gesture recognizers — NavigationLink now swallows child gestures. Fix:

```swift
NavigationLink { destination } label: { content }
    .buttonStyle(.plain)              // Unlock child gestures
    .highPriorityGesture(myGesture)   // Win priority over nav
    .contentShape(Rectangle())         // Proper hit testing
```

### Liquid Glass Sheets

Partial detent **required** for glass appearance:
```swift
.presentationDetents([.medium, .large])  // Required
```

## Animations

### Animation Curves

- Use `DesignTokens.Animation` springs for all animations (never hard-coded `.easeInOut`)
- Prefer spring animations for interactive feedback (checkbox, toggle, tap)
- Use `gentleSpring` for soft confirmations, `bouncySpring` for playful interactions
- Always respect `@Environment(\.accessibilityReduceMotion)` for spring/bouncy animations

### Post-Animation Callbacks

```swift
// Good — iOS 17+ completion handler (tied to actual animation lifecycle)
withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
    isChecked = true
} completion: {
    onToggle()
}

// Bad — fragile, not tied to animation duration
DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { onToggle() }
Task { try? await Task.sleep(for: .seconds(0.5)); onToggle() }
```

**NEVER** use `DispatchQueue.main.asyncAfter` or `Task.sleep` for post-animation callbacks.
Use `withAnimation(_:body:completion:)` — fires when animation completes, handles reduced motion automatically.

### SF Symbol Transitions

```swift
// Content change (different symbol names) — use contentTransition
Image(systemName: isChecked ? "checkmark.circle.fill" : "circle")
    .contentTransition(.symbolEffect(.replace))

// Same symbol, state-driven effect — use symbolEffect
Image(systemName: "heart.fill")
    .symbolEffect(.bounce, value: likeCount)
```

### Haptic Feedback

```swift
// Good — iOS 17+ declarative API
.sensoryFeedback(.success, trigger: triggerFeedback)

// Bad — UIKit imperative API
UIImpactFeedbackGenerator(style: .medium).impactOccurred()
```

## Safe Area Modifiers

### Modifier Ordering: `.ignoresSafeArea` BEFORE `.frame`

`.ignoresSafeArea(edges:)` must apply **before** `.frame(height:)` for view to extend into safe area. If `.frame` locks height first, `.ignoresSafeArea` has nothing to extend.

```swift
// Good — ignoresSafeArea before frame: view extends into safe area
VariableBlurView(maxBlurRadius: 8, direction: .blurredBottomClearTop)
    .allowsHitTesting(false)
    .ignoresSafeArea(edges: .bottom)
    .frame(height: 80)

// Bad — frame locks height before ignoresSafeArea can extend it
VariableBlurView(maxBlurRadius: 8, direction: .blurredBottomClearTop)
    .frame(height: 80)
    .ignoresSafeArea(edges: .bottom)  // too late — height already fixed
```

**Component applies `.frame` internally** (like `ProgressiveBlurEdge`): inline underlying view, reorder modifiers.

### Separate Overlays for Different Safe Area Behavior

Overlay needs `.ignoresSafeArea` but sibling view (e.g., floating button) must stay within safe area: use **two separate `.overlay()` modifiers** — never wrap in shared ZStack:

```swift
// Good — blur extends into safe area, button stays within
.overlay(alignment: .bottom) {
    BlurView().ignoresSafeArea(edges: .bottom)
}
.overlay(alignment: .bottomTrailing) {
    FloatingButton().padding(.bottom, 16)
}

// Bad — ZStack absorbs ignoresSafeArea, neither child extends
.overlay(alignment: .bottom) {
    ZStack {
        BlurView()
        FloatingButton()
    }
    .ignoresSafeArea(edges: .bottom)  // doesn't extend child views
}
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `@StateObject` / `@ObservedObject` | `@State` / `@Environment` with `@Observable` |
| `@EnvironmentObject` | `@Environment(Type.self)` |
| `ObservableObject` + `@Published` | `@Observable` macro |
| `.onAppear { Task { } }` | `.task { }` modifier |
| `NavigationView` | `NavigationStack(path:)` |
| Massive view bodies | Extract subviews and `@ViewBuilder` |
| Inline date/number formatters | Shared `Formatters/` singleton |
| Glass on content views | Glass on navigation elements only |
| `AsyncImage` without caching | NSCache wrapper or Nuke/Kingfisher |
| `DispatchQueue.main.asyncAfter` | `withAnimation { } completion: { }` |
| `Task.sleep` for animation delay | `withAnimation` completion handler |
| Hard-coded `.easeInOut(duration:)` | `DesignTokens.Animation` springs |
| `UIImpactFeedbackGenerator` | `.sensoryFeedback()` modifier |