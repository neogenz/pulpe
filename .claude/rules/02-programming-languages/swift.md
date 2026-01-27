---
description: "Swift language conventions, concurrency, types, and access control"
paths: "ios/**/*.swift"
---

# Swift

## Naming Conventions

Follow Apple Swift API Design Guidelines:

| Element | Convention | Example |
|---------|------------|---------|
| Types, protocols | `UpperCamelCase` | `BudgetService`, `StoreProtocol` |
| Methods, properties | `lowerCamelCase` | `fetchBudget()`, `isLoading` |
| Acronyms | Uniform case | `apiClient`, `urlString`, `HTTPMethod` |
| Boolean properties | Read as assertions | `isEmpty`, `isLoading`, `hasError` |
| Constants | `lowerCamelCase` | `let maxRetryCount = 3` |
| Static constants | `lowerCamelCase` | `static let shared` |

### Method Naming

```swift
// Good - verbs for mutations
func loadBudget() async throws
func toggleTransaction(_ tx: Transaction) async
func deleteExpense(id: String) async throws

// Good - nouns for value-returning
func formattedAmount() -> String
func filteredTransactions() -> [Transaction]

// Bad
func doStuff()
func process()
func handle()
```

### Argument Labels

```swift
// Good - reads as English phrase
func remove(at index: Int)
func insert(_ element: Element, at index: Int)
func move(from source: IndexSet, to destination: Int)

// Bad - redundant type info
func removeElement(element: Element)
func insertElement(element: Element, atIndex: Int)
```

## Strict Types

- Never use `Any` or `AnyObject` unless interfacing with Objective-C
- Prefer `unknown` patterns over force casts
- Use `as?` (conditional cast), avoid `as!` (force cast)

```swift
// Good - safe cast
if let budget = response as? Budget {
    process(budget)
}

// Good - pattern matching
switch error {
case let apiError as APIError:
    handle(apiError)
default:
    handleUnknown(error)
}

// Bad - force cast (crashes at runtime)
let budget = response as! Budget
```

## Value Types vs Reference Types

| Use | Type | When |
|-----|------|------|
| `struct` | Value type | Models, data containers, simple state |
| `actor` | Reference type | Services with shared mutable state |
| `class` | Reference type | Only when `@Observable` required (stores) |
| `enum` | Value type | Typed destinations, error cases, variants |

**Default to `struct`**. Use `class` only for `@Observable` stores.

## Access Control

```swift
// Good - restrictive by default
@Observable @MainActor
final class BudgetListStore {
    private(set) var budgets: [Budget] = []    // Read externally, write internally
    private var lastLoadDate: Date?             // Fully private
    private let service: BudgetService          // Injected dependency

    func loadIfNeeded() async { }              // Public API (implicit internal)
}
```

| Context | Modifier |
|---------|----------|
| Store state | `private(set)` |
| Implementation details | `private` |
| Internal to module | No modifier (implicit `internal`) |
| Injected dependencies | `private let` |

## Concurrency

### async/await

```swift
// Good - structured concurrency
func loadData() async {
    isLoading = true
    defer { isLoading = false }

    do {
        budget = try await budgetService.getCurrentMonthBudget()
    } catch {
        self.error = error
    }
}
```

### Actors for Thread Safety

```swift
// Good - actor isolates state
actor BudgetService {
    static let shared = BudgetService()
    private let apiClient: APIClient

    func fetchBudget(id: String) async throws -> Budget {
        try await apiClient.request(.getBudget(id: id))
    }
}
```

### @MainActor for UI State

```swift
// Good - all stores on main actor
@Observable @MainActor
final class CurrentMonthStore: StoreProtocol {
    // All property updates happen on main thread
}
```

### Task Usage in Views

```swift
// Good - .task for async work
var body: some View {
    List { /* ... */ }
        .task { await store.loadIfNeeded() }
        .refreshable { await store.forceRefresh() }
}

// Bad - .onAppear with Task { }
.onAppear {
    Task { await store.loadIfNeeded() } // Use .task instead
}
```

## Error Handling

```swift
// Good - do/catch with specific handling
do {
    let budget = try await service.fetchBudget(id: id)
    self.budget = budget
} catch let error as APIError {
    switch error {
    case .unauthorized: appState.logout()
    case .notFound: self.error = error
    default: self.error = error
    }
} catch {
    self.error = error
}

// Good - optional try for non-critical operations
let cached = try? cacheService.load()
```

## Enums for Type Safety

```swift
// Good - typed destinations
enum BudgetDestination: Hashable {
    case details(id: String)
    case edit(budget: Budget)
}

// Good - API endpoints
enum Endpoint {
    case getCurrentMonth
    case getBudget(id: String)
    case createTransaction(budgetId: String)

    var path: String { /* ... */ }
    var method: HTTPMethod { /* ... */ }
}
```

## Protocol-Oriented Patterns

```swift
// Good - protocol for shared behavior
protocol StoreProtocol: Observable {
    var isLoading: Bool { get }
    var error: Error? { get }
    func loadIfNeeded() async
    func forceRefresh() async
}
```

- Define protocols for shared behaviors
- Default implementations via extensions
- Prefer composition over inheritance

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `as!` force cast | `as?` conditional cast |
| `Any` / `AnyObject` | Concrete types or generics |
| `class` for models | `struct` with `Sendable` |
| `.onAppear { Task { } }` | `.task { }` modifier |
| Implicit `self` everywhere | Omit `self` (Swift default) |
| `var` when value doesn't change | `let` for constants |
| Deeply nested `if let` | `guard let` for early returns |
