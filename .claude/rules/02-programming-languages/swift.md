---
description: "Swift language conventions, concurrency, types, and access control"
paths: "ios/**/*.swift"
---

# Swift

Apple's API Design Guidelines apply as written — naming, argument labels, boolean
assertions. `.swiftlint.yml` enforces `sorted_imports`, `force_unwrapping`,
`implicitly_unwrapped_optional`, `identifier_name` and the length limits; what follows is
only what neither the guidelines nor the linter cover.

## Value Types vs Reference Types

| Use | Type | When |
|-----|------|------|
| `struct` | Value type | Models, data containers, simple state |
| `actor` | Reference type | Services with shared mutable state |
| `class` | Reference type | Only when `@Observable` required (stores) |
| `enum` | Value type | Typed destinations, error cases, variants |

**Default `struct`**. `class` only for `@Observable` stores. `StoreProtocol`'s own shape
lives in `ios-architecture.md`.

## Access Control

| Context | Modifier |
|---------|----------|
| Store state | `private(set)` — read externally, write internally |
| Implementation details | `private` |
| Internal to module | No modifier (implicit `internal`) |
| Injected dependencies | `private let` |

## Swift 6 & 6.2+ Features

### Language Mode

Project uses **Swift 6** (`SWIFT_VERSION: "6"`). Concurrency violations = compile errors, not warnings.

### Task Naming (Swift 6.2 — SE-0469)

Name stored/cancellable tasks for Instruments visibility:

```swift
// Good — named tasks visible in Instruments' Swift Concurrency instrument
let task = Task(name: "BudgetList.load") { await loadBudgets() }
backgroundRefreshTask = Task(name: "AppState.backgroundRefresh") { ... }
Task.detached(name: "BudgetList.widgetSync", priority: .utility) { ... }

// OK — fire-and-forget UI bridge tasks don't need names
Task { appState.send(.someEvent) }
```

### nonisolated(unsafe) — Test-Only Pattern

Swift 6: captured `var` in `@Sendable` closures = compile error. Tests where closures run sequentially on `@MainActor`, use `nonisolated(unsafe)`:

```swift
// Good — test pattern, safe because closure runs on @MainActor
nonisolated(unsafe) var callCount = 0
let vm = ViewModel(dependencies: .init(fetch: { callCount += 1 }))
await vm.submit()
#expect(callCount == 1)
```

**Never `nonisolated(unsafe)` in production** — use actors or `@MainActor` isolation.

### TaskGroup + @MainActor (Swift 6 Limitation)

`TaskGroup.addTask` requires `sending` closures — incompatible with `@MainActor` captured state in Swift 6. Use `Task.init` (inherits caller isolation):

```swift
// Bad — Swift 6 error: sending parameter risks data races
await withTaskGroup(of: Void.self) { group in
    group.addTask { @MainActor in await store.forceRefresh() }
}

// Good — Task.init inherits @MainActor isolation from caller
let tasks = (0..<5).map { _ in Task { await store.forceRefresh() } }
for task in tasks { await task.value }
```

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `as!` force cast | `as?` conditional cast |
| `Any` / `AnyObject` | Concrete types or generics |
| `class` for models | `struct` with `Sendable` |
| `.onAppear { Task { } }` | `.task { }` modifier |
| `Task {` for stored tasks | `Task(name: "Context.action") {` |
| `nonisolated(unsafe)` in prod | `actor` or `@MainActor` isolation |
