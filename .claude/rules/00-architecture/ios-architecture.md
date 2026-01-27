---
description: "iOS app architecture - layers, stores, services, dependency flow"
paths: "ios/**/*.swift"
---

# iOS Architecture

## Application Structure

```
ios/Pulpe/
├── App/                    # Entry point, global state, tab navigation
│   ├── PulpeApp.swift      # @main entry, deep linking
│   ├── AppState.swift      # Global state machine (@Observable @MainActor)
│   └── MainTabView.swift   # Root tab navigation
├── Core/                   # Infrastructure (actors, singletons)
│   ├── Auth/               # AuthService, KeychainManager, BiometricService
│   ├── Network/            # APIClient, Endpoints, APIError
│   ├── Config/             # AppConfiguration
│   └── Background/         # BackgroundTaskService
├── Domain/                 # Business logic
│   ├── Models/             # Sendable structs (Budget, Transaction, BudgetLine)
│   ├── Store/              # StoreProtocol, feature stores
│   ├── Services/           # Actor-based services (BudgetService, etc.)
│   └── Formulas/           # Pure calculation functions
├── Features/               # UI organized by feature
│   ├── Auth/               # Login flow
│   ├── CurrentMonth/       # Dashboard views
│   ├── Budgets/            # Budget CRUD
│   ├── Templates/          # Template management
│   ├── Onboarding/         # First-run experience
│   └── Account/            # User settings
├── Shared/                 # Reusable building blocks
│   ├── Components/         # ToastManager, SyncIndicator
│   ├── Design/             # Design tokens, colors
│   ├── Extensions/         # Date, Decimal, String extensions
│   ├── Formatters/         # Currency, date formatters
│   └── Styles/             # Button, text styles
└── Resources/              # Assets, Lottie animations
```

## Dependency Flow

```
Features/ ──────┬──▶ Domain/ (stores, models, formulas)
                ├──▶ Shared/ (components, extensions, styles)
                └──▶ Core/   (via stores that inject services)

Domain/  ───────┬──▶ Core/   (services use APIClient, Auth)
                └──▶ Models are standalone (Sendable structs)

Core/    ───────▶ (nothing - infrastructure foundation)

Shared/  ───────▶ (nothing - reusable utilities)
```

**FORBIDDEN Dependencies**:
- `Core/` → `Domain/` or `Features/` (lower level)
- `Domain/` → `Features/` (never depend on UI)
- `Shared/` → `Features/` or `Domain/` (generic utilities)
- `Features/X` → `Features/Y` (feature isolation)

## Store Pattern (Global State)

Global stores live in `Domain/Store/` and implement `StoreProtocol`:

```swift
@Observable @MainActor
final class CurrentMonthStore: StoreProtocol {
    private(set) var budget: Budget?
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    private let budgetService: BudgetService

    func loadIfNeeded() async   // Smart cache (30s TTL)
    func forceRefresh() async   // Bypass cache
}
```

**Key rules:**
- Always `@Observable @MainActor final class`
- `private(set)` for all published state
- Implement `StoreProtocol` for cache management
- Constructor injection with `.shared` defaults
- Stores injected via `.environment()` in views

## ViewModel Pattern (Feature-Level State)

Feature-specific ViewModels are **co-located in the view file** they serve:

```swift
// BudgetDetailsView.swift

struct BudgetDetailsView: View {
    @State private var viewModel: BudgetDetailsViewModel

    var body: some View { /* ... */ }
}

// ViewModel defined in same file
@Observable @MainActor
final class BudgetDetailsViewModel {
    private(set) var budget: Budget?
    private(set) var isLoading = false
    private let budgetService = BudgetService.shared

    init(budgetId: String) { /* ... */ }
}
```

**Key rules:**
- Feature ViewModels live in the **same file** as their view
- Same `@Observable @MainActor final class` pattern as stores
- Owned by the view via `@State private var viewModel`
- Use when feature needs local state beyond what a global store provides

## Service Pattern (Data Access)

Services are **actors** for thread safety:

```swift
actor BudgetService {
    static let shared = BudgetService()
    private let apiClient: APIClient

    func getCurrentMonthBudget() async throws -> Budget?
    func getBudgetWithDetails(id: String) async throws -> BudgetDetails
}
```

**Key rules:**
- Always `actor` (not class)
- `static let shared` singleton pattern
- All methods `async throws`
- Services wrap APIClient calls
- No UI logic in services

## Model Pattern

Models are **Sendable structs**:

```swift
struct Budget: Codable, Sendable, Identifiable {
    let id: String
    let name: String
    let startDate: Date
    let endDate: Date
    let budgetLines: [BudgetLine]
}
```

**Key rules:**
- Always `struct` (value type)
- Always `Sendable` (thread-safe)
- Always `Codable` (API serialization)
- `Identifiable` when used in lists
- No business logic in models (use Formulas/)

## Navigation Pattern

```swift
// Typed navigation with NavigationStack
@State private var path = NavigationPath()

NavigationStack(path: $path) {
    BudgetListView()
        .navigationDestination(for: BudgetDestination.self) { dest in
            switch dest {
            case .details(let id): BudgetDetailsView(budgetId: id)
            case .edit(let budget): BudgetEditView(budget: budget)
            }
        }
}
```

- Use `NavigationStack(path:)` with typed destinations
- Define destination enums per feature
- Sheet-based forms with completion callbacks

## Dependency Injection

```swift
// App level: provide stores
MainTabView()
    .environment(appState)
    .environment(currentMonthStore)
    .environment(budgetListStore)

// View level: consume stores
struct BudgetListView: View {
    @Environment(BudgetListStore.self) private var store
}
```

- Use `.environment()` for store injection
- `@Environment(Type.self)` for consumption
- Constructor injection for services into stores

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `class` for services | `actor` for thread safety |
| `ObservableObject` + `@Published` | `@Observable @MainActor` |
| `@StateObject` / `@ObservedObject` | `@State` / `@Environment` |
| Public mutable state in stores | `private(set)` for all state |
| Models as classes | Models as `Sendable` structs |
| ViewModel in separate file | Co-locate ViewModel in view file |
| Deeply nested NavigationLink | `NavigationStack(path:)` + typed destinations |
| `providedIn: root` equivalent | `.shared` singleton for actors |
