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
- Always combine with `@MainActor` for UI state
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
// Good - sheet with completion callback
.sheet(isPresented: $showAddExpense) {
    AddExpenseView { newExpense in
        await store.addExpense(newExpense)
    }
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

Partial detent is **required** for glass appearance:
```swift
.presentationDetents([.medium, .large])  // Required
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
